<script setup>
import { data } from 'autoprefixer';
import HelloWorld from './components/HelloWorld.vue';
</script>

<template>

    <div id="app">

        <header>

            <img alt="Vue logo" class="logo" src="@/assets/logo.svg" width="125" height="125" />

            <div class="wrapper">

                <div class="greetings">
                    <h1 class="green" style="text-wrap: nowrap; word-break: break-all;">29's Home</h1>
                    <h3>好好学习，天天向上</h3>
                </div>

                <nav>
                    <a href="javascript:" @click="toAdmin" v-if="isAdmin">Admin</a>
                    <a href="javascript:" @click="AlistOption" v-if="isAdmin">AlistOption</a>
                </nav>

            </div>
        </header>

        <div class="adminLinks" v-if="isAdmin && showAdminSide">
            <a href="javascript:" style="display: block; width: 100%; text-align: left; margin-bottom: 10px;"
                v-for="link in links" :key="link.name" @click="JumpURL(link)">{{ link.name }}</a>
        </div>
        <div class="tips" v-if="tipsText?.length">
            <div class="close" @click="tipsText = []">X</div>
            <transition-group name="list-complete" tag="p">
                <p v-for="tip in tipsText" :key="tip" class="list-complete-item">{{ tip }}</p>
            </transition-group>
        </div>
    </div>
</template>

<script>
import { computed } from 'vue';
import { post, get } from '@/utils/request';


export default {
    data() {
        return {
            host: '',
            links: [],
            tipsText: [],
            showAdminSide: false
        };
    },
    computed: {
        isAdmin() {
            return this.$route.query?.test == 'zp29'
        }
    },
    created() {

        // const VITE_Server_Host = import.meta.env?.VITE_Server_Host ?? '127.0.0.1'
        // this.VITE_Server_Host = VITE_Server_Host 
        // this.host = VITE_Server_Host || window.location.hostname
        this.host = window.location.hostname

        // console.log('App.vue this.host -> ', VITE_Server_Host, this.host)

        // setInterval(() => {
        //     this.tipsText.push('test')
        // }, 500)
    },
    methods: {
        toAdmin() {
            this.showAdminSide = true
            this.links = [
                {
                    name: 'OpenWrt',
                    path: `${this.host}:9000/cgi-bin/luci/admin/quickstart/`
                },
                {
                    name: 'Emby',
                    path: `${this.host}:8096/`
                },
                {
                    name: 'Alist',
                    path: `${this.host}:5244/`
                },
                {
                    name: 'NasTools',
                    path: `${this.host}:3000/`
                },
                {
                    name: 'MOVIEPILOT',
                    path: `${this.host}:3001/`
                },
                {
                    name: 'BT',
                    path: 'https://btdig.com/index.htm',
                },
                {
                    name: 'BTM',
                    path: 'https://clm20240801.xn--yets15cv4k.com',
                },
            ]
        },
        AlistOption() {

            post(`http://${this.host}:3000/getLinks`, {})
                .then(response => {
                    console.log('getLinks:', response.data.data)
                    this.links = response?.data?.data ?? []
                })
                .catch(error => {
                    console.error('getLinks error:', error)
                    this.links = [
                        {
                            "name": "更新115Mov",
                            "path": "/pan/115/mov",
                            "id": "3"
                        },
                        {
                            "name": "更新115Tv",
                            "path": "/pan/115/tv",
                            "id": "557"
                        }, 
                    ]
                });

            this.showAdminSide = true

        },
        ListenerWebSocket() {
            const WS_URL = `ws://${this.host}:18095`;
            const ws = new WebSocket(WS_URL)
            ws.onopen = (event) => {
                console.log('Connected to WebSocket server', event);
                this.tipsText = []
                this.tipsText.push('开始生成')
                this.AutoScroll()
            }
            ws.onmessage = (event) => {
                const message = JSON.parse(event.data);
                // console.log('WebSocket onmessage', message);
                switch (message.status) {
                    case 'start':
                        this.tipsText.push('文件总数: ' + message.total)
                        console.log(`WebSocket Generation started. Total files: ${message.total}`);
                        break;
                    case 'progress':
                        this.tipsText.push(`文件 ${message.current} of ${message.total}: ${message.movie}`)
                        console.log(`WebSocket Processing file ${message.current} of ${message.total}: ${message.movie}`);
                        this.$nextTick(() => {
                            this.AutoScroll()
                        })
                        break;
                    case 'done':
                        ws.close();
                        this.tipsText.push(`文件共${message.total}个，生成成功`)
                        this.$nextTick(() => {
                            this.AutoScroll()
                        })
                        break;
                    default:
                        this.tipsText.push(message.message)
                        this.$nextTick(() => {
                            this.AutoScroll()
                        })
                }
            }
        },
        PostAPI(item) {
            post(`http://${this.host}:3000/${item.apiPath}`, {alistPath:item.name})
                .then(response => {
                    console.log('POST request sent, server response:', response.data);
                })
                .catch(error => {
                    console.error('Error sending POST request:', error);
                });
        },
        updateModel(path, id, sizi) {
            this.ListenerWebSocket()
            const body = {
                alistPath: path,
                embyItemId: id
            }
            if (sizi) {
                body.sizi = sizi
            }
            post(`http://${this.host}:3000/generateStrm`, body)
                .then(response => {
                    console.log('POST request sent, server response:', response.data);
                })
                .catch(error => {
                    console.error('Error sending POST request:', error);
                });
        },

        JumpURL(item) {
            if(item.path && item.id) this.updateModel(item.path, item.id, item.sizi)
            else if(item.apiPath) this.PostAPI(item)
            else window.open(item.path)
        },
        AutoScroll() {
            var element = document.querySelector(".tips")
            element.scrollTop = element.scrollHeight;
        }
    },
};
</script>

<style scoped lang="less">
header {
    max-height: 100vh;
    line-height: 1.5;
}

.logo {
    display: block;
    margin: 0 auto 2rem;
}

nav {
    width: 100%;
    margin-top: 2rem;
    font-size: 12px;
    text-align: center;
}

nav a.router-link-exact-active {
    color: var(--color-text);
}

nav a.router-link-exact-active:hover {
    background-color: transparent;
}

nav a {
    display: inline-block;
    padding: 0 1rem;
    border-left: 1px solid var(--color-border);
}

nav a:first-of-type {
    border: 0;
}

@media (min-width: 1024px) {
    header {
        display: flex;
        place-items: center;
        padding-right: calc(var(--section-gap) / 2);
    }

    .logo {
        margin: 0 2rem 0 0;
    }

    header .wrapper {
        display: flex;
        flex-wrap: wrap;
        place-items: flex-start;
    }

    nav {
        padding: 1rem 0;
        margin-top: 1rem;
        margin-left: -1rem;
        font-size: 1rem;
        text-align: left;
    }
}

.adminLinks {
    margin-top: 10px;
    padding: 10px;
    border: 1px solid #ccc;
    border-radius: 5px;
    display: flex;
    flex-direction: column;
}

.tips {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    flex-direction: column;
    color: #fff;
    max-height: 100vh;
    padding: 4%;
    overflow: scroll;
    align-items: center;
    .close {
        position: fixed;
        top: 10px;
        right: 10px;
        font-size: 20px;
        width: 50px;
        height: 50px;
        line-height: 55px;
        text-align: center;
        cursor: pointer;
        font-size: 18px;
        font-family: fantasy;
        background: #000;
        border-radius: 50%;
        z-index: 999;
        &:hover {
            color: #ccc;
        }
    }
    > p {
        display: flex;
        flex-direction: column-reverse; /* 消息从下往上排列 */
        margin-top: 20px;
    }
    p > p {
        border: 1px solid #fff;
        padding: 10px;
        border-radius: 5px;
        min-width: 90%;
    }
    p > p + p {
        margin-top: 10px;
    }
    &::before {
        content: 'loading...';
        margin-top: 20px;
        animation: loading 1s linear infinite;
        @keyframes loading {
            0% {
                content: 'loading';
            }
            25% {
                content: 'loading.';
            }
            50% {
                content: 'loading..';
            }
            75% {
                content: 'loading...';
            }
            100% {
                content: 'loading';
            }
        }
    }
}

h1 {
  top: -10px;
  font-size: 2.6rem;
  font-weight: 500;
}

h3 {
  font-size: 1.2rem;
}

.greetings h1,
.greetings h3 {
  text-align: center;
}

@media (min-width: 1024px) {
  .greetings h1,
  .greetings h3 {
    display: block;
    text-align: left;
  }
}

.list-complete-item {
  transition: all 1s;
  display: inline-block;
  margin-right: 10px;
}
.list-complete-enter, .list-complete-leave-to
/* .list-complete-leave-active for below version 2.1.8 */ {
  opacity: 0;
  transform: translateY(-30px);
}
.list-complete-leave-active {
  position: absolute;
}
</style>
