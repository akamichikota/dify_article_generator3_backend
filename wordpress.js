const express = require('express');
const axios = require('axios');
const { marked } = require('marked'); // Added: Import marked library

const router = express.Router();

// WordPressへの投稿エンドポイント
router.post('/post-to-wordpress', async (req, res) => {
  const { title, content, wordpress_username, application_password, siteurl, status } = req.body; // Added: Receive status

  // MarkdownをHTMLに変換
  const htmlContent = marked(content); // Convert Markdown to HTML

  // 受け取ったデータをログに出力
  console.log('受け取ったデータ:', {
    title,
    content,
    wordpress_username,
    application_password,
    siteurl,
    status // Added: Log status
  });

  // WordPressのREST APIエンドポイント
  const wordpressApiUrl = `${siteurl.replace(/\/$/, '')}/wp-json/wp/v2/posts`;

  try {
    const response = await axios.post(wordpressApiUrl, {
      title: title,
      content: htmlContent, // Use HTML content
      status: status // Use status
    }, {
      auth: {
        username: wordpress_username,
        password: application_password
      }
    });

    res.status(201).json({ message: '投稿が成功しました', data: response.data });
  } catch (error) {
    console.error('WordPressへの投稿中にエラーが発生しました:', error.response ? error.response.data : error.message);
    res.status(500).json({ error: 'WordPressへの投稿中にエラーが発生しました' });
  }
});

module.exports = router;