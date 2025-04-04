# Alist Strm (todo...)

<p align="center">
  <span>中文 | <a href="./README.en.md">En</a></span>
</p>

### 流程

- 自动任务(定时 0 3,9,11,18,23 * * *)
> 3点会清空缓存

- 手动任务(telegram/web)

the list of commands is invalid. Please use this format:

updatestrm - 更新STRM
resetstrm - 重建STR

You can also send /empty to clear the list or keep it empty.

## Features

+ ⚡️ 通过path生成strm
+ ⚡️ 通知更新 Emby & tinyMediaManager


## Todo 

- [ ] ⚡️ 定时更新
- [ ] ⚡️ WEBHOOK

## Use

1. 网盘找资源
2. 打开 http://${host}:8080?test=zp29
3. 点击配置好的目录，自动更新emby&tmm
4. 打开 emby

### Build

>  http://${host}:8080

```bash
touch links.json
vim links.json

touch docker-compose.yml
vim docker-compose.yml # copy yal

## set up
docker-compose up -d
```

```yml
# docker-compose.yml
AlistStrm:
  image: zp29/aliststrm
  ports:
    - "8080:8080"  # 映射前端端口
    - "3000:3000"  # 映射后端端口
  volumes:
    - ./links.json:/app/links.json
  environment:
    - OMDB_API_KEY=...
    - TMDB_API_KEY=...
    - TMM_API_KEY=...
    - EMBY_TOKEN=...
    - ALIST_TOKEN=...
```

```js
// links.json
[
    {
        "name": "更新115Mov",
        "path": "/pan/115/mov",
        // Alist Path
        "id": "3"
        // EmbyID
    },
    {
      ...
    }
]
```

> zp29