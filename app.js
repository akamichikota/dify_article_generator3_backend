const express = require('express');
const axios = require('axios');
const cors = require('cors');
const dotenv = require('dotenv');
const bodyParser = require('body-parser');
const path = require('path');
const wordpressRouter = require('./wordpress'); // 新しいルーターをインポート

dotenv.config(); // 環境変数を読み込む

const app = express();

app.use(express.json());
app.use(bodyParser.json());

// CORSを有効にする（開発中のみ）
app.use(cors({
  origin: 'http://localhost:3000'  // フロントエンドのURL
}));


// デフォルト値を定義
const DEFAULT_TITLE_PROMPT = `
Q&A式の記事を書きたいので、タイトルには「？」を含めてください。
人間の悩みに注目してタイトルを考えてください。
タイトルはよくある質問や疑問を反映させるものにし、読者の興味を引くようなキャッチーな言葉やフレーズを使ってください。
`;

const DEFAULT_CONTENT_PROMPT = `
- 最初の数行で読者の興味を引き、続きを読みみたくなるようにしてください。
- 必ず日本の情報を参照してください。日本語以外をベースに書かれた情報は参照しないでください。なぜなら、記事を自然な日本語にするためです。
- 文章量は必ず2000文字以上にしてください。
`;

const DEFAULT_API_ENDPOINT = 'https://api.dify.ai/v1/chat-messages';
const DEFAULT_API_KEY = process.env.DIFY_API_KEY || 'default_api_key_null';

let settings = {
  title_prompt: '', // デフォルトを空文字列に設定
  content_prompt: '', // デフォルトを空文字列に設定
  api_endpoint: '', // デフォルトを空文字列に設定
  api_key: '', // デフォルトを空文字列に設定
  variable1: '', // デフォルトを空文字列に設定
  variable2: '', // デフォルトを空文字列に設定
  wordpress_username: '', // 新しいフィールドを追加
  application_password: '', // 新しいフィールドを追加
  siteurl: '', // 新しいフィールドを追加
  keyword_generator_url: '', // 新しいフィールドを追加
  x_server_url: '', // 新しいフィールドを追加
  rakkokeyword_url: '' // 新しいフィールドを追加
};

// 設定を取得するエンドポイント
app.get('/settings', (req, res) => {
  console.log('GET /settings リクエストを受信しました'); // ログ出力
  res.json(settings);
});

// 設定を保存するエンドポイント
app.post('/settings', (req, res) => {
  console.log('POST /settings リクエストを受信しました:', req.body); // 追加: リクエストボディをログに出力
  try {
    const { title_prompt, content_prompt, api_endpoint, api_key, variable1, variable2, wordpress_username, application_password, siteurl, keyword_generator_url, x_server_url, rakkokeyword_url } = req.body;
    
    // 受信したデータを設定に保存
    settings.title_prompt = title_prompt || '';
    settings.content_prompt = content_prompt || '';
    settings.api_endpoint = api_endpoint || '';
    settings.api_key = api_key || '';
    settings.variable1 = variable1 || '';
    settings.variable2 = variable2 || '';
    settings.wordpress_username = wordpress_username || ''; // 変更
    settings.application_password = application_password || ''; // 変更
    settings.siteurl = siteurl || ''; // 変更
    settings.keyword_generator_url = keyword_generator_url || ''; // URLを保存
    settings.x_server_url = x_server_url || ''; // URLを保存
    settings.rakkokeyword_url = rakkokeyword_url || ''; // URLを保存

    res.json({ message: '設定が正常に更新されました' });
  } catch (error) {
    console.error('設定の保存中にエラーが発生しました:', error);
    res.status(500).json({ error: '設定の保存中にエラーが発生しました' });
  }
});

// WordPressへの投稿エンドポイントを使用
app.use('/api', wordpressRouter); // 新しいルーターを追加

app.get('/generate-articles', async (req, res) => { // ここを async にする
  console.log('GET /generate-articles リクエストを受信しました:', req.query); // 追加: リクエストのクエリをログに出力
  const { query, format } = req.query;
  console.log(`クエリ: ${query}, フォーマット: ${format}`); // 追加: クエリとフォーマットをログに出力

  const apiKey = settings.api_key || DEFAULT_API_KEY; // デフォルト値を設定
  const apiEndpoint = settings.api_endpoint || DEFAULT_API_ENDPOINT; // デフォルト値を設定
  const titlePrompt = settings.title_prompt || DEFAULT_TITLE_PROMPT; // デフォルト値を設定
  const contentPrompt = settings.content_prompt || DEFAULT_CONTENT_PROMPT; // デフォルト値を設定
  const variable1 = settings.variable1 || '';
  const variable2 = settings.variable2 || '';
  const wordpressUsername = settings.wordpress_username || ''; // 変更
  const applicationPassword = settings.application_password || ''; // 変更
  const siteUrl = settings.siteurl || ''; // 変更

  console.log(`記事生成リクエストを受信しました: ${query}`);

  try {
    const keywords = query.split(',').map(keyword => keyword.trim());
    const requests = keywords.map(keyword =>
      axios.post(apiEndpoint, {
        inputs: {
          title_prompt: titlePrompt,
          content_prompt: contentPrompt,
          format: format,
          variable1: variable1,
          variable2: variable2,
          wordpress_username: wordpressUsername,
          application_password: applicationPassword,
          siteurl: siteUrl
        },
        query: keyword,
        response_mode: "streaming",
        user: wordpressUsername // 変更: ここを受け取ったwordpressUsernameに変更
      }, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        responseType: 'stream'
      }).catch(err => {
        console.error(`APIリクエスト中にエラーが発生しました: ${err.message}`);
        throw new Error('APIリクエスト中にエラーが発生しました');
      })
    );

    // MIMEタイプを設定
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const responses = await Promise.all(requests); // ここで await を使用

    responses.forEach((response, index) => {
      let buffer = '';
      let finalAnswer = '';
      let finalTitle = '';
      let titleConfirmed = false;

      response.data.on('data', async (chunk) => { // ここを async にする
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const jsonString = line.replace(/^data: /, '');
            try {
              const data = JSON.parse(jsonString);
              console.log('受信したデータ:', data);
              const currentKeyword = keywords[index];

              if (data.event === 'node_finished') {
                if (!titleConfirmed && data.data.title === 'TITLE') {
                  finalTitle = data.data.outputs.text;
                  titleConfirmed = true;
                } else if (!titleConfirmed) {
                  finalTitle = `${currentKeyword} - ${index + 1}`;
                }
              }

              if (data.event === 'workflow_finished') {
                finalAnswer = data.data.outputs.answer;

                // formatがdemoでない場合のみWordPressへの投稿を呼び出す
                if (format !== 'demo') {
                  await axios.post(`${process.env.API_URL}/api/post-to-wordpress`, {
                    title: finalTitle,
                    content: finalAnswer,
                    status: format,
                    wordpress_username: settings.wordpress_username,
                    application_password: settings.application_password,
                    siteurl: settings.siteurl
                  });
                }

                res.write(`event: message\ndata: ${JSON.stringify({ title: finalTitle, answer: finalAnswer })}\n\n`);
                finalTitle = '';
                finalAnswer = '';
              }
            } catch (e) {
              console.error('JSON解析エラー:', e);
            }
          }
        }
      });

      response.data.on('end', () => {
        res.write('event: end\n\n');
      });
    });

    // すべてのレスポンスが終了した後に呼び出す
    res.on('close', () => {
      res.end();
    });

    // 記事生成後にデフォルト値を使用した場合のみ設定をリセット
    if (settings.api_endpoint === DEFAULT_API_ENDPOINT) settings.api_endpoint = '';
    if (settings.title_prompt === DEFAULT_TITLE_PROMPT) settings.title_prompt = '';
    if (settings.content_prompt === DEFAULT_CONTENT_PROMPT) settings.content_prompt = '';
    if (settings.api_key === DEFAULT_API_KEY) settings.api_key = '';

  } catch (error) {
    console.error('記事生成中のエラー:', error.message);
    res.status(500).json({ error: '記事生成中にエラーが発生しました' });
  }
});

// フロントエンドの静的ファイルを提供
app.use(express.static(path.join(__dirname, '../frontend/build')));

// すべてのリクエストに対してindex.htmlを返す
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/build', 'index.html'));
});

const PORT = process.env.PORT || 3030;
app.listen(PORT, () => {
  console.log(`サーバーがポート${PORT}で稼働中です`);
});