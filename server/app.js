const express = require('express');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const WebSocket = require('ws');
var cors = require('cors')

const app = express();
app.use(express.json());
app.use(cors())

const Server_Host = process.env.Server_Host || '127.0.0.1';
const OMDB_API_KEY = process.env.OMDB_API_KEY;
const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMM_API_KEY = process.env.TMM_API_KEY;
const EMBY_TOKEN = process.env.EMBY_TOKEN;
const ALIST_TOKEN = process.envALIST_TOKEN;

console.log('后端接受 变量 env -> ', process.env)
console.log('前端 http://127.0.0.1:8080')
console.log('后端 http://127.0.0.1:3000')

const wss = new WebSocket.Server({ port: 18095 });

// 配置Alist API信息
const EMBY_API_URL = `${Server_Host}:8096`;
const ALIST_API_URL = `${Server_Host}:5244`;
const TMM_API_URL = `${Server_Host}:787`;

app.post('/updateTMM', async (req, res) => {
    res.header("Access-Control-Allow-Origin", "*");
    
    let TMMState = await notifyTMM(alistPath)
    res.status(200).send({ status: TMMState ? 'success' : 'error' });
})
app.post('/updateEmby', async (req, res) => {
    res.header("Access-Control-Allow-Origin", "*");
   
    let notifyEmbyState = await notifyEmby(embyItemId)
    res.status(200).send({ status: notifyEmbyState ? 'success' : 'error' });
})

/**
 * 生成strm文件的接口
 * @param {string} alistPath - 要扫描的Alist路径
 * @param {string} outputDir - 输出strm文件的目录
 */
app.post('/generateStrm', async (req, res) => {
    res.header("Access-Control-Allow-Origin", "*");
    const { alistPath, embyItemId, outputDir = '/Users/a29/Downloads/LocMedia/link' } = req.body;

    if (!alistPath) {
        res.send({ status: 'error', message: 'alistPath is required' });
        return
    }

    console.log('generateStrm alistPath, embyItemId, outputDir -> ', alistPath, embyItemId, outputDir)

    try {

        // 发送开始消息
        wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ status: 'start', total: '??' }));
            }
        });

        console.log('generateStrm 更新Alist')
        await updateAlist(alistPath);

        await clearStrmFile(outputDir + alistPath);

        const files = await getVideoFiles(alistPath);
        console.log(`generateStrm 更新Alist，${files.length}个文件`)

        // 发送开始消息
        wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ status: 'start', total: files.length }));
            }
        });


        console.log('generateStrm 开始创建Strm')
        for (let i = 0; i < files.length; i++) {
            const video = files[i];
            const videoFilePath = path.join(video.parent, video.name);
            const outputFilePath = path.join(outputDir, video.parent, `${path.basename(video.name, path.extname(video.name))}.strm`);
            const nfoFilePath = path.join(outputDir, video.parent, `${path.basename(video.name, path.extname(video.name))}.nfo`);

            // 创建必要的目录
            await createDirRecursively(path.dirname(outputFilePath));

            console.log('generateStrm.js video.isMainVideo -> ', video.name, outputFilePath, video.isMainVideo)

            if (video.isMainVideo) {
                await createStrmFile(outputFilePath, videoFilePath);

                // console.log(`generateStrm 可以获取电影信息 -> ${video.name}`)
                // 假装请求电影信息
                await new Promise(resolve => setTimeout(resolve, 1));
                // // // 获取电影信息
                // const movieInfo = await getMovieInfo(path.basename(video.name, path.extname(video.name)));
                // // // 生成nfo文件
                // console.log(`generateStrm 获取电影信息完成 -> ${movieInfo}`)
                // createNfoFile(nfoFilePath, movieInfo);
                // console.log(`generateStrm 创建电影信息完成 -> ${video.name}`)
            }

            // 发送进度更新
            wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({ status: 'progress', total: files.length, current: i + 1, movie: video.name }));
                }
            });

        }

        wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ message: `共${files.length}个文件，生成Strmp完成` }));
            }
        });
        console.log('generateStrm Strmp完成')

        let TMMState = await notifyTMM(alistPath)
        console.log('generateStrm 通知TMM State ==', TMMState)
        wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ message: `通知TMM完成 State->${TMMState}` }));
            }
        });

        let notifyEmbyState = await notifyEmby(embyItemId)
        notifyEmbyState ? console.log('generateStrm 通知Emby完成') : console.log('generateStrm 通知Emby失败')
        wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                let notMes = notifyEmbyState ? '通知Emby完成' : '通知Emby失败'
                client.send(JSON.stringify({ message: `${notMes}，打开${EMBY_API_URL}查看` }));
            }
        });

        // 发送完成消息
        wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ status: 'done', total: files.length }));
            }
        });
        res.status(200).send('strm and nfo files are being generated.');

    } catch (error) {
        console.error('Error generating strm and nfo files:', error);
        wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ status: 'error', message: `error->${error}` }));
            }
        });
        res.status(500).send('Error generating strm and nfo files.');
    }
})

// const PORT = process.env.PORT || 8095;
// app.listen(PORT, () => {
//     console.log(`Server is running on port ${PORT}`);
// });


/**
 * 找到文件夹下的所有视频文件
 * @param {string} path - 文件夹路径
 */
async function getVideoFiles(alistPath) {
    try {

        const apiUrl = `${ALIST_API_URL}/api/fs/list`

        let refreshArr = []

        async function fetchFiles(path) {
            let refresh = !refreshArr.includes(path)
            // console.log('generateStrm.js refresh -> ', path, refresh)
            const response = await axios.post(apiUrl, { path, refresh }, {
                headers: {
                    'Authorization': ALIST_TOKEN,
                    'Content-Type': 'application/json'
                }
            })

            refreshArr.push(path)
            refreshArr = [...new Set(refreshArr)]
            // console.log('generateStrm.js refreshArr -> ', refreshArr)
            const items = response?.data?.data?.content || [];
            wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({ message: `${refresh} => ${path} -> 文件夹下的文件数量：${items.length}` }));
                }
            });

            let videoFiles = [];

            for (const item of items) {
                const fullPath = path + '/' + item.name;

                if (item.is_dir) {
                    const nestedFiles = await fetchFiles(fullPath);
                    videoFiles = videoFiles.concat(nestedFiles);
                } else if (item.type === 2) { // type 2 表示视频文件
                    videoFiles.push({
                        parent: path,
                        name: item.name,
                        is_dir: false,
                        size: item.size,
                        type: item.type
                    });
                }
            }

            return videoFiles;
        }

        // return await fetchFiles(alistPath);

        let list = await fetchFiles(alistPath);


        list = list.map(item => {
            let videoMinSIZE = item?.path?.includes('jav') ? 100 : 10
            item.isMainVideo = item.size > 1024 * 1024 * videoMinSIZE;
            return item
        });

        return list
    } catch (error) {

    }
}


// 清空strm文件
function clearStrmFile(dirPath, level = 6) {
    return new Promise((resolve, reject) => {
        let deletedFiles = [];

        function deleteStrmFiles(currentPath, currentLevel) {
            if (currentLevel > level) return Promise.resolve();

            return new Promise((res, rej) => {
                fs.readdir(currentPath, (err, files) => {
                    // console.log('generateStrm.js curreatPath -> ', currentPath, files.length)
                    if (err) return rej(err);

                    let promises = files.map(file => {
                        let filePath = path.join(currentPath, file);

                        return new Promise((resolveFile, rejectFile) => {
                            fs.stat(filePath, (err, stats) => {
                                if (err) return rejectFile(err);

                                if (stats.isDirectory()) {
                                    deleteStrmFiles(filePath, currentLevel + 1).then(resolveFile).catch(rejectFile);
                                } else if (stats.isFile() && path.extname(file) === '.strm') {
                                    fs.unlink(filePath, (err) => {
                                        if (err) return rejectFile(err);
                                        deletedFiles.push(filePath);
                                        resolveFile();
                                    });
                                } else {
                                    resolveFile();
                                }
                            });
                        });
                    });

                    Promise.all(promises).then(() => res()).catch(rej);
                });
            });
        }

        deleteStrmFiles(dirPath, 1)
            .then(() => resolve(deletedFiles))
            .catch(reject);
    });
}

// 创建目录
async function createDirRecursively(dir) {
    if (!fs.existsSync(dir)) {
        await fs.promises.mkdir(dir, { recursive: true });
    }
}


// 生成strm文件
async function createStrmFile(outputPath, videoFilePath) {
    const strmContent = ALIST_API_URL + '/d' + videoFilePath;
    await fs.promises.writeFile(outputPath, strmContent);
}


// 获取电影信息
// async function getMovieInfo(movieName) {
//     const response = await axios.get(`http://www.omdbapi.com/?t=${encodeURIComponent(movieName)}&apikey=${OMDB_API_KEY}`);
//     console.log('generateStrm.js response -> ', movieName, response)
//     return response.data;
// }
// 获取电影信息
async function getMovieInfo(movieName) {
    const response = await axios.get(`https://api.themoviedb.org/3/search/movie`, {
        params: {
            api_key: TMDB_API_KEY,
            query: movieName,
            language: 'zh-CN'
        }
    });
    const results = response.data.results;
    console.log('generateStrm.js results -> ', movieName, results)
    results.sort((a, b) => b.popularity - a.popularity);
    return results.length > 0 ? results[0] : null;
}

// 更新alist目录
async function updateAlist(alistPath) {
    var data = JSON.stringify({
        "path": alistPath,
        "password": "",
        "page": 1,
        "per_page": 1000,
        "refresh": true
    });
    console.log('generateStrm.js updateAlist alistPath -> ', alistPath, data)
    const response = await axios.post(`${ALIST_API_URL}/api/fs/list`, data, {
        headers: {
            'Authorization': ALIST_TOKEN,
            'Content-Type': 'application/json'
        }
    })
    // 等待2秒
    await new Promise(resolve => setTimeout(resolve, 1000));
    return response.data;
}


// 通知tnn更新
async function notifyTMM(alistPath) {
    // curl -d '{"action":"scrape", "scope":{"name":"all"}}' -H "Content-Type: application/json" -H "api-key: f8ea228e-2caf-48b0-9aae-7501f8a34568" -X POST http://localhost:7878/api/movies
    // TMM_API_URL
    // TMM_API_KEY
    // action：update -> 更新文件
    // action：scrape -> 搜刮

    let updateApiPath = alistPath.includes('mov') ? `${TMM_API_URL}/api/movies` : `${TMM_API_URL}/api/tvshows`;

    try{
        const updateResponse = await axios.post(updateApiPath, { action: 'update', scope: { name: 'all', } }, { headers: { 'api-key': TMM_API_KEY, 'Content-Type': 'application/json' } })
        // 可能要扫库，这里等待1秒
        await new Promise(resolve => setTimeout(resolve, 1000));
    
        const scrapeResponse = await axios.post(updateApiPath, { action: 'scrape', scope: { name: 'all', } }, { headers: { 'api-key': TMM_API_KEY, 'Content-Type': 'application/json' } })
        await new Promise(resolve => setTimeout(resolve, 2000));

        return true;
    } catch {
        return false
    }
}
// 通知emby更新
async function notifyEmby(embyItemId) {
    let response
    console.log('generateStrm.js updateEmby embyItemId -> ', embyItemId)
    console.log('generateStrm.js url -> ', `${EMBY_API_URL}/emby/Items/${embyItemId}/Refresh?api_key=${EMBY_TOKEN}`)
    if (embyItemId) {
        response = await axios.post(`${EMBY_API_URL}/emby/Items/${embyItemId}/Refresh?api_key=${EMBY_TOKEN}`, undefined, {
            headers: {
                'accept': '*/*',
                'content-type': 'application/x-www-form-urlencoded'
            }
        })
    }

    if (response.status != 200 && response.status != 204) {
        console.log('generateStrm.js 更新库失败，准备全部扫描')
        response = await axios.post(`${EMBY_API_URL}/emby/Library/Refresh?api_key=${EMBY_TOKEN}`, undefined, {
            headers: {
                'accept': '*/*',
                'content-type': 'application/x-www-form-urlencoded'
            },
        })
    }

    if (response.status != 200 && response.status != 204) {
        console.log('generateStrm.js updateEmby 更新库失败，全部扫描也失败了 response -> ', response)
    }
    return response.status == 200 || response.status == 204;
}

// 生成info文件
function createNfoFile(outputPath, movieInfo) {
    const nfoContent = `
      <movie>
        <title>${movieInfo.title}</title>
        <year>${new Date(movieInfo.release_date).getFullYear()}</year>
        <rating>${movieInfo.vote_average}</rating>
        <released>${movieInfo.release_date}</released>
        <runtime>${movieInfo.runtime}</runtime>
        <genre>${movieInfo.genre_ids.join(', ')}</genre>
        <overview>${movieInfo.overview}</overview>
        <language>${movieInfo.original_language}</language>
        <poster>https://image.tmdb.org/t/p/original${movieInfo.poster_path}</poster>
        <backdrop>https://image.tmdb.org/t/p/original${movieInfo.backdrop_path}</backdrop>
        <popularity>${movieInfo.popularity}</popularity>
        <vote_count>${movieInfo.vote_count}</vote_count>
        <tmdb_id>${movieInfo.id}</tmdb_id>
      </movie>
    `;
    fs.writeFileSync(outputPath, nfoContent.trim());
}
