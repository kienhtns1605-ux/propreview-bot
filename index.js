const express = require('express');
const axios = require('axios');
const Parser = require('rss-parser');
const parser = new Parser();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const postedArticleIds = new Set();

// 1. GIAO DIỆN CALCULATOR BĐS
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="vi">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>PropReview AI - Đánh Giá Hiệu Suất BĐS</title>
        <style>
            body { font-family: Arial, sans-serif; background: #f0f2f5; padding: 20px; display: flex; justify-content: center; }
            .card { background: #fff; padding: 25px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); width: 100%; max-width: 450px; }
            h2 { color: #1a73e8; text-align: center; }
            .form-group { margin-bottom: 15px; }
            label { display: block; font-weight: bold; margin-bottom: 5px; }
            input { width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 6px; box-sizing: border-box; }
            button { background: #1a73e8; color: white; border: none; padding: 12px; width: 100%; border-radius: 6px; font-weight: bold; cursor: pointer; }
            .result { margin-top: 20px; background: #e8f0fe; padding: 15px; border-radius: 6px; display: none; }
        </style>
    </head>
    <body>
        <div class="card">
            <h2>🏢 PropReview AI</h2>
            <div class="form-group"><label>Giá mua BĐS (Triệu VNĐ):</label><input type="number" id="price" value="2500"></div>
            <div class="form-group"><label>Tiền cho thuê/tháng (Triệu):</label><input type="number" id="rent" value="12"></div>
            <div class="form-group"><label>Vay ngân hàng (Triệu):</label><input type="number" id="loan" value="1500"></div>
            <button onclick="calculate()">PHÂN TÍCH NGAY</button>
            <div class="result" id="resultBox">
                <h3>📊 KẾT QUẢ PHÂN TÍCH</h3>
                <div id="resYield"></div>
                <div id="resCashflow"></div>
            </div>
        </div>
        <script>
            function calculate() {
                const price = parseFloat(document.getElementById('price').value) || 0;
                const rent = parseFloat(document.getElementById('rent').value) || 0;
                const loan = parseFloat(document.getElementById('loan').value) || 0;
                if (price <= 0) return alert('Vui lòng nhập giá hợp lệ');
                const yieldPercent = ((rent * 12) / price) * 100;
                const monthlyLoan = loan > 0 ? (loan / 240) + (loan * (0.095 / 12)) : 0;
                const netCashflow = rent - monthlyLoan;
                document.getElementById('resYield').innerHTML = '📈 <b>Yield:</b> ' + yieldPercent.toFixed(2) + '%/năm';
                document.getElementById('resCashflow').innerHTML = '🟢 <b>Dòng tiền ròng:</b> ' + netCashflow.toFixed(2) + ' triệu/tháng';
                document.getElementById('resultBox').style.display = 'block';
            }
        </script>
    </body>
    </html>
  `);
});

// 2. HÀM LẤY TIN BĐS MỚI TỪ RSS CAFEF
async function fetchLatestBdsNews() {
  try {
    const feed = await parser.parseURL('https://cafef.vn/bat-dong-san.rss'); 
    const latestItem = feed.items[0];
    if (!latestItem) return null;

    const id = latestItem.guid || latestItem.link;
    if (postedArticleIds.has(id)) return null;

    return { 
      id, 
      title: latestItem.title, 
      summary: latestItem.contentSnippet || latestItem.title, 
      link: latestItem.link 
    };
  } catch (error) {
    console.error('❌ Lỗi lấy tin RSS:', error.message);
    return null;
  }
}

// 3. HÀM ĐĂNG BÀI LÊN FANPAGE QUA GRAPH API
async function postToFacebookPage(content) {
  const PAGE_TOKEN = process.env.PAGE_ACCESS_TOKEN;

  if (!PAGE_TOKEN) {
    console.error('⚠️ LỖI: Chưa cấu hình PAGE_ACCESS_TOKEN trên Render!');
    return false;
  }

  try {
    const url = `https://graph.facebook.com/v18.0/me/feed`;
    const response = await axios.post(url, {
      message: content,
      access_token: PAGE_TOKEN
    });

    console.log('✅ ĐÃ ĐĂNG BÀI LÊN FANPAGE THÀNH CÔNG! Post ID:',
