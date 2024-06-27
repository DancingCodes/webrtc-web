<template>
    <div class="app">
        <van-nav-bar title="MoonMirror" />
        <div class="body">
            <!-- 我的图像 -->
            <video ref="myVideo" muted class="myVideo video"></video>
            <!-- 对方的图像 -->
            <video ref="otherVideo" class="otherVideo video"></video>
            <!-- 操作按钮 -->
            <div class="operatingButton">
                <van-button v-show="!isCalling" plain size="small" class="button" @click="requestCall">请求通话</van-button>
                <van-button v-show="isCalling" plain size="small" class="button" @click="breakCall">挂断</van-button>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref } from "vue";

import { showConfirmDialog } from 'vant';
import { io } from "socket.io-client";

const sock = io(import.meta.env.VITE_APP_API_URL);
const roomId = '001'
// 连接Socket服务器
sock.on("connectionSuccess", () => {
    console.log("Socket服务器连接成功");

    // 加入房间
    sock.emit("joinRoom", roomId);

    // 收到请求通话
    sock.on('requestCall', () => {
        if (identity.value !== '发起方') {
            showConfirmDialog({
                title: '新消息',
                message: '有人请求与您通话，是否接收？',
                confirmButtonText: '同意',
                cancelButtonText: '拒绝'
            }).then(() => {
                identity.value = '接收方'
                isCalling.value = true
                sock.emit('agreeCall', roomId)
            })
        }
    })

    // 收到同意通话、发送offer
    sock.on('agreeCall', async () => {
        if (identity.value === '发起方') {
            // 创建RTCPeerConnection
            peer.value = new RTCPeerConnection({
                iceServers: [
                    { url: "stun:stun.l.google.com:19302" }, // 谷歌的公共服务
                ],
            })
            // 添加本地音视频流
            peer.value.addStream(localStream.value)
            // 获取candidate信息
            peer.value.onicecandidate = (event) => {
                if (event.candidate) {
                    // 发送candidate信息
                    sock.emit('sendCandidate', {
                        roomId,
                        candidate: event.candidate
                    })
                }
            }
            // 获取对方的音视频流
            peer.value.onaddstream = (event) => {
                otherVideo.value.srcObject = event.stream
                otherVideo.value.play()
            }
            // 生成offer
            const offer = await peer.value.createOffer({
                offerToReceiveAudio: 1,
                offerToReceiveVideo: 1
            })
            // 设置本地描述offer
            await peer.value.setLocalDescription(offer)
            // 发送offer给对方
            sock.emit('sendOffer', { offer, roomId })

        }
    })

    // 接收offer、发送Answer
    sock.on('sendOffer', async (offer) => {
        if (identity.value === '接收方') {
            // 获取视频流并且开启我的视频画面
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: true,
                video: true
            })
            myVideo.value.srcObject = stream
            myVideo.value.play()
            // 创建自己的RTCPeerConnection
            peer.value = new RTCPeerConnection({
                iceServers: [
                    { url: "stun:stun.l.google.com:19302" }, // 谷歌的公共服务
                ],
            })
            // 添加本地音视频流
            peer.value.addStream(stream)
            // 获取candidate信息
            peer.value.onicecandidate = (event) => {
                if (event.candidate) {
                    // 发送candidate信息
                    sock.emit('sendCandidate', {
                        roomId,
                        candidate: event.candidate
                    })
                }
            }
            // 获取对方的音视频流
            peer.value.onaddstream = (event) => {
                otherVideo.value.srcObject = event.stream
                otherVideo.value.play()
            }
            // 设置远端描述
            await peer.value.setRemoteDescription(offer);
            // 生成answer
            const answer = await peer.value.createAnswer()
            // 设置本地描述answer
            await peer.value.setLocalDescription(answer);
            // 发送answer给对方
            sock.emit('sendAnswer', { answer, roomId })
        }
    })

    // 接收answer
    sock.on('sendAnswer', async (answer) => {
        if (identity.value === '发起方') {
            // 设置远端描述anser
            await peer.value.setRemoteDescription(answer);
        }
    });

    // 接收candidate
    sock.on('sendCandidate', async (candidate) => {
        if (peer.value) {
            await peer.value.addIceCandidate(candidate);
        }
    });

    // 退出
    sock.on('breakCall', async () => {
        myVideo.value.srcObject = null
        otherVideo.value.srcObject = null
        isCalling.value = false
        identity.value = null
    });
});


// VideoRef
const otherVideo = ref()
const myVideo = ref()

// 是否正在通话
const isCalling = ref(false)
// 当前身份
const identity = ref()

// 本地视频流
const localStream = ref()
// WebRtc
const peer = ref()

// 请求通话
const requestCall = async () => {
    // 设置发起方身份
    identity.value = '发起方'
    isCalling.value = true
    // 获取视频流并且开启我的视频画面
    const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true
    })
    myVideo.value.srcObject = stream
    myVideo.value.play()
    // 保存本地视频流
    localStream.value = stream
    // 向服务器发送请求通话事件
    sock.emit('requestCall', roomId)
}

// 断开童话
const breakCall = () => {
    sock.emit('breakCall', roomId)
}

</script>

<style lang="scss" scoped>
.app {
    height: 100vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;

    .body {
        flex: 1;
        position: relative;

        .video {
            object-fit: cover;
        }

        .myVideo {
            width: 100%;
            height: 100%;
            background-color: rgba($color: #000000, $alpha: 0.1);
        }

        .otherVideo {
            width: 30%;
            height: 20%;
            position: absolute;
            right: 0;
            background-color: rgba($color: #000000, $alpha: 0.2);
        }

        .operatingButton {
            position: absolute;
            bottom: 10%;
            width: 100%;
            display: flex;
            align-items: center;
            padding: 0 10%;
            box-sizing: border-box;

            .button:not(:first-child) {
                margin-left: 20px;
            }
        }
    }
}
</style>