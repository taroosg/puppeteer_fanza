const functions = require('firebase-functions');
const express = require("express");
const cors = require('cors');
const puppeteer = require('puppeteer');
require('dotenv').config();

const app = express();

app.use(cors());

app.get('/actresses', (req, res) => {

  (async () => {
    // string2boolean
    // 環境変数でDEBUG_MODEの切り替え
    // const options = JSON.parse(process.env.DEBUG)
    //   ? { devtools: true }
    //   : {};
    const options = {
      headless: true,
      args: ['--no-sandbox'],
    };
    // ブラウザを立ち上げる
    const browser = await puppeteer.launch(options);
    // ブラウザのタブを開く
    const page = await browser.newPage();
    // ユーザーエージェントを適当に設定
    await page.setUserAgent(
      `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/75.0.3770.100 Safari/537.36`
    );
    // リクエストのフィルタリングを有効化する
    await page.setRequestInterception(true);
    // リクエストイベントを受け取る
    page.on('request', request => {
      if (request.resourceType() === 'image') {
        // 画像の場合はリクエストをブロックする
        request.abort();
      } else {
        // その他の要素はリクエストを許可する
        request.continue();
      }
    });

    // url指定して移動
    await page.goto('https://wav.tv/actresses/best-ranked?country=JP');
    const results = [];
    // 次へボタンをquerysellectorAllしてlengthが0より大きいときは実行し続ける
    // とりあえず5ページ分実行
    const pages = 3;
    for (var i = 0; i < pages; i++) {
      await page.waitFor(() => {
        // 画面下部までスクロールする
        window.scrollTo(0, document.body.scrollHeight);
        const notes = document.querySelectorAll('.m-actress--thumbnail-img');
        return notes.length > 0;
      });
      // 探す要素の指定
      const query = '.m-actress--thumbnail-img img';
      const currentPageData = await page.$$eval(query, anchors =>
        anchors.map(anchor => ({
          name: anchor.alt.slice(0, anchor.alt.indexOf(' - ')), imageUrl: anchor.src
          // name: anchor.alt, imageUrl: anchor.src
        }))
      );
      // 配列に追加
      results.push(currentPageData);
      // 次へボタンクリック
      if (i < pages - 1) {
        await Promise.all([
          page.waitForNavigation({ timeout: 20000, waitUntil: "domcontentloaded" }),
          page.click('.m-pagination--next')
        ]);
      }
    }

    // 配列をまとめる関数
    const multiArray2singleArray = (array) => {
      return array.reduce((a, c) => {
        return Array.isArray(c) ? a.concat(multiArray2singleArray(c)) : a.concat(c);
      }, []);
    };

    // レスポンス，人気順の上位100で切り出し
    res.send({
      data: multiArray2singleArray(results).slice(0, 100)
    })

    // ブラウザを閉じる
    await browser.close();

  })();

});


// 出力
const api = functions.https.onRequest(app);
module.exports = { api };