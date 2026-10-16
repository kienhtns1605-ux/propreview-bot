const express = require('express');
const axios = require('axios');
const Parser = require('rss-parser');
const parser = new Parser();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Tập hợp lưu các bài viết đã đăng để không bị trùng lặp
const postedArticleIds = new Set();

// =========================================================================
// 1. GIAO DIỆN WEB APP TÍNH DÒNG TIỀN BĐS (Dùng chia sẻ nhóm Zalo/Messenger)
// =========================================================================
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="vi">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>PropReview AI - Đánh Giá Hiệu Suất BĐS</title>
        <style>
            body { font-family: Arial, sans-serif; background: #f0f2f5; margin: 0; padding: 20px; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
            .card { background: #ffffff; padding: 25px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); width: 100%; max-width: 450px; }
            h2 { color: #1a73e8; text-align: center; margin-bottom: 5px; }
            .subtitle { text-align: center; color: #666; font-size: 14px; margin-bottom: 20px; }
            .form-group { margin-bottom: 15px; }
            label { display: block; font-weight: bold; margin-bottom: 5px; color: #333; }
            input { width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 6px; box-sizing: border-box; font-size: 16px; }
            button { background: #1a73e8; color: white; border: none; padding: 12px; width: 100%; border-radius: 6px; font-size: 16px; font-weight: bold; cursor: pointer; margin-top: 10px; }
            button:hover { background: #1557b0; }
            .result { margin-top: 20px; background: #e8f0fe; padding: 15px; border-radius: 6px; border-left: 5px solid #1a73e8; display: none; }
            .result h3 { margin-top: 0; color: #1a73e8; }
            .line { margin: 8px 0; font-size: 15px; color: #333; }
            .positive { color: #0d652d; font-weight: bold; }
            .negative { color: #c5221f; font-weight: bold; }
        </style>
    </head>
    <body>
        <div class="card">
            <h2>🏢 PropReview AI</h2>
            <div class="subtitle">Công cụ Phân tích Dòng tiền & Đòn bẩy BĐS</div>
            <div class="form-group">
                <label>Giá mua BĐS (Triệu VNĐ):</label>
                <input type="number" id="price" placeholder="VD: 2500 (tức 2.5 tỷ)" value="2500">
            </div>
            <div class="form-group">
                <label>Tiền cho thuê hàng tháng (Triệu):</label>
                <input type="number" id="rent" placeholder="VD: 12" value="12">
            </div>
            <div class="form-group">
                <label>Vay ngân hàng (Triệu - Bỏ trống nếu không vay):</label>
                <input type="number" id="loan" placeholder="VD: 1500" value="1500">
            </div>
            <button onclick="calculate()">PHÂN TÍCH NGAY</button>
            <div class="result" id="resultBox">
                <h3>📊 KẾT QUẢ PHÂN TÍCH</h3>
                <div class="line" id="resYield"></div>
                <div class="line" id="resLoan"></div>
                <div class="line" id="resCashflow"></div>
            </div>
        </div>
        <script>
            function calculate() {
                const price = parseFloat(document.getElementById('price').value) || 0;
                const rent = parseFloat(document.getElementById('rent').value) || 0;
                const loan = parseFloat(document.getElementById('loan').value) || 0;
                if (price <= 0) { alert('Vui lòng nhập giá mua hợp lệ!'); return; }
                const yieldPercent = ((rent * 12) / price) * 100;
                let monthlyLoanPayment = 0;
                if (loan > 0) {
                    monthlyLoanPayment = (loan / 240) + (loan * (0.095 / 12));
                }
                const netCashflow = rent - monthlyLoanPayment;
                document.getElementById('resYield').innerHTML = '📈 <b>Tỷ suất dòng tiền (Yield):</b> ' + yieldPercent.toFixed(2) + '%/năm';
                document.getElementById('resLoan').innerHTML = loan > 0 ? '💳 <b>Gốc + Lãi NH (tháng đầu):</b> ~' + monthlyLoanPayment.toFixed(2) + ' triệu/tháng' : '';
                document.getElementById('resCashflow').innerHTML = netCashflow >= 0 
                    ? '🟢 <b>Dòng tiền ròng:</b> <span class="positive">+' + netCashflow.toFixed(2) + ' triệu/tháng</span>' 
                    : '🔴 <b>Dòng tiền ròng:</b> <span class="negative">' + netCashflow.toFixed(2) + ' triệu/tháng</span>';
                document.getElementById('resultBox').style.display = 'block';
            }
        </script>
    </body>
    </html>
  `);
});

// =========================================================================
// 2. LOGIC CÀO TIN TỨC BĐS MỚI NHẤT
// =========================================================================
async function fetchLatestBdsNews() {
  try {
    // Lấy tin từ RSS BĐS CafeF / Batdongsan
    const feed = await parser.parseURL('https://cafef.vn/bat-dong-san.rss'); 
    const latestItem = feed.items[0];

    if (!latestItem) {
      console.log('⏰ Không tìm thấy tin tức nào.');
      return null;
    }

    const articleId = latestItem.guid || latestItem.link;
    if (postedArticleIds.has(articleId)) {
      console.log('⏰ Bài viết này đã được đăng trước đó rồi.');
      return null;
    }

    return {
      id: articleId,
      title: latestItem.title,
      summary: latestItem.contentSnippet || latestItem.content || latestItem.title,
      link: latestItem.link
    };
  } catch (error) {
    console.error('❌ Lỗi khi lấy tin tức BĐS:', error.message);
    return null;
  }
}

// =========================================================================
// 3. BIÊN TẬP BÀI ĐĂNG CHUẨN FACEBOOK GROUP
// =========================================================================
function formatFacebookPost(title, summary, link) {
  const cleanSummary = summary.replace(/<[^>]*>?/gm, '').trim();
  const shortSummary = cleanSummary.length > 250 ? cleanSummary.substring(0, 250) + '...' : cleanSummary;

  return `📰 [TIN TỨC BẤT ĐỘNG SẢN HOT]\n\n` +
         `🔥 ${title.toUpperCase()}\n\n` +
         `📌 ${shortSummary}\n\n` +
         `👉 Đọc bài gốc tại: ${link}\n\n` +
         `💡 Anh/chị nhà đầu tư đánh giá thế nào về thông tin này? Hãy để lại bình luận bên dưới nhé!\n\n` +
         `#BatDongSan #DauTuBDS #TinTucBDS #Happywork #PropReviewAI`;
}

// =========================================================================
// 4. HÀM TỰ ĐỘNG ĐĂNG BÀI LÊN GROUP QUA PAGE ADMIN
// =========================================================================
async function postToFacebookGroup(content) {
  const GROUP_ID = process.env.FB_GROUP_ID;
  const PAGE_TOKEN = process.env.PAGE_ACCESS_TOKEN;

  if (!GROUP_ID || !PAGE_TOKEN) {
    console.error('⚠️ LỖI: Chưa cấu hình FB_GROUP_ID hoặc PAGE_ACCESS_TOKEN trên Render!');
    return false;
  }

  try {
    const url = `https://graph.facebook.com/v18.0/${GROUP_ID}/feed`;
    const response = await axios.post(url, {
      message: content,
      access_token: PAGE_TOKEN
    });

    console.log('✅ ĐÃ ĐĂNG BÀI TỰ ĐỘNG THÀNH CÔNG! Post ID:', response.data.id);
    return true;
  } catch (error) {
    console.error('❌ LỖI KHI ĐĂNG BÀI LÊN GROUP:', error.response ? JSON.stringify(error.response.data) : error.message);
    return false;
  }
}

// =========================================================================
// 5. LỊCH TỰ ĐỘNG CHẠY MỖI 1 TIẾNG
// =========================================================================
async function autoNewsJob() {
  console.log('🔍 [AUTO] Đang quét tin BĐS mới...');
  const news = await fetchLatestBdsNews();
  if (news) {
    const postContent = formatFacebookPost(news.title, news.summary, news.link);
    const success = await postToFacebookGroup(postContent);
    if (success) {
      postedArticleIds.add(news.id);
    }
  }
}

// Tự động quét mỗi 60 phút (3,600,000 miligiây)
setInterval(autoNewsJob, 60 * 60 * 1000);

// Endpoint để bấm kích hoạt đăng bài thủ công (dùng để kiểm tra)
app.get('/trigger-news', async (req, res) => {
  console.log('🚀 Đã nhận lệnh kích hoạt đăng tin thủ công...');
  const news = await fetchLatestBdsNews();
  if (news) {
    const postContent = formatFacebookPost(news.title, news.summary, news.link);
    const success = await postToFacebookGroup(postContent);
    if (success) {
      postedArticleIds.add(news.id);
      return res.send('✅ ĐÃ ĐĂNG BÀI THÀNH CÔNG LÊN GROUP! Mở Group Facebook để kiểm tra nhé.');
    } else {
      return res.send('❌ ĐĂNG BÀI THẤT BẠI. Mở tab Logs trên Render để xem nguyên nhân.');
    }
  } else {
    res.send('⏰ Chưa có tin tức mới hoặc bài mới nhất đã được đăng rồi!');
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 Server PropReview AI đang chạy ở cổng ${PORT}`);
});
