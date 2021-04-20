#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const https = require('https');
const {
    URL
} = require('url');
const chalk = require('chalk');
const log = console.log;


const arg = process.argv.splice(2)[0];
// console.log(arg, 'arg')
const root = path.join(process.cwd(), arg);
exts = ['.jpg', '.png'],
    max = 5200000; // 5MB == 5242848.754299136


const options = {
    method: 'POST',
    hostname: 'tinypng.com',
    path: '/web/shrink',
    headers: {
        rejectUnauthorized: false,
        'Postman-Token': Date.now(),
        'Cache-Control': 'no-cache',
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/56.0.2924.87 Safari/537.36'
    }
};

fileList(root);


// 生成随机IP， 赋值给 X-Forwarded-For
function getRandomIP() {
    return Array.from(Array(4)).map(() => parseInt(Math.random() * 255)).join('.')
}

// 获取文件列表
function fileList(folder) {
    fs.readdir(folder, (err, files) => {
        if (err) console.error(err);
        files.forEach(file => {
            fileFilter(path.join(folder, file));
        });
    });
}

// 过滤文件格式，返回所有jpg,png图片
function fileFilter(file) {
    fs.stat(file, (err, stats) => {
        if (err) return console.error(err);
        if (
            // 必须是文件，小于5MB，后缀 jpg||png
            stats.size <= max &&
            stats.isFile() &&
            exts.includes(path.extname(file))
        ) {

            // 通过 X-Forwarded-For 头部伪造客户端IP
            options.headers['X-Forwarded-For'] = getRandomIP();

            fileUpload(file); // console.log('可以压缩：' + file);
        }
        // if (stats.isDirectory()) fileList(file + '/');
    });
}

// 异步API,压缩图片
// {"error":"Bad request","message":"Request is invalid"}
// {"input": { "size": 887, "type": "image/png" },"output": { "size": 785, "type": "image/png", "width": 81, "height": 81, "ratio": 0.885, "url": "https://tinypng.com/web/output/7aztz90nq5p9545zch8gjzqg5ubdatd6" }}
function fileUpload(img) {
    var req = https.request(options, function (res) {
        res.on('data', buf => {
            let obj = JSON.parse(buf.toString());
            if (obj.error) {
                log(chalk.yellow(`[${img}]：压缩失败！报错：${obj.message}`));
            } else {
                try {
                    fileUpdate(img, obj);
                } catch (error) {
                    console.log(error)
                }
            }
        });
    });

    req.write(fs.readFileSync(img), 'binary');
    req.on('error', e => {
        console.error(e);
    });
    req.end();
}
// 该方法被循环调用,请求图片数据
function fileUpdate(imgpath, obj) {
    const outputDir = path.join(root, 'output');
    imgpath = path.join(root, 'output', imgpath.replace(root, ''));

    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir);
    }

    let options = new URL(obj.output.url);
    let req = https.request(options, res => {
        let body = '';
        res.setEncoding('binary');
        res.on('data', function (data) {
            body += data;
        });

        res.on('end', function () {
            fs.writeFile(imgpath, body, 'binary', err => {
                if (err) return console.error(err);
                log(`[${chalk.gray(imgpath)}]  ${chalk.cyan((obj.output.size/1024).toFixed(2) + 'Kb')} / ${chalk.dim((obj.input.size/1024).toFixed(2))}Kb =  ${chalk.cyan((1 - obj.output.ratio) * 100 + '%')}`);
            });
        });
    });
    req.on('error', e => {
        console.error(e);
    });
    req.end();
}
