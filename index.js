const express = require('express');
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 1. Giao diện Website trực quan cho khách hàng tự tính toán
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

                if (price <= 0) {
                    alert('Vui lòng nhập giá mua hợp lệ!');
                    return;
                }

                // Tính toán
                const annualRent = rent * 12;
                const yieldPercent = (annualRent / price) * 100;

                let monthlyLoanPayment = 0;
                if (loan > 0) {
                    const principalPayment = loan / 240; // 20 năm = 240 tháng
                    const interestPayment = loan * (0.095 / 12); // Lãi suất 9.5%/năm
                    monthlyLoanPayment = principalPayment + interestPayment;
                }

                const netCashflow = rent - monthlyLoanPayment;

                // Hiển thị kết quả
                let htmlYield = \`📈 <b>Tỷ suất dòng tiền (Yield):</b> \${yieldPercent.toFixed(2)}%/năm\`;
                let htmlLoan = '';
                let htmlCashflow = '';

                if (loan > 0) {
                    htmlLoan = \`💳 <b>Gốc + Lãi NH (tháng đầu):</b> ~\${monthlyLoanPayment.toFixed(2)} triệu/tháng\`;
                    if (netCashflow >= 0) {
                        htmlCashflow = \`🟢 <b>Dòng tiền ròng:</b> <span class="positive">+\${netCashflow.toFixed(2)} triệu/tháng (Dư dả)</span>\`;
                    } else {
                        htmlCashflow = \`🔴 <b>Dòng tiền ròng:</b> <span class="negative">\${netCashflow.toFixed(2)} triệu/tháng (Cần bù thêm)</span>\`;
                    }
                } else {
                    htmlCashflow = \`🟢 <b>Dòng tiền ròng:</b> <span class="positive">+\${rent} triệu/tháng (Không vay)</span>\`;
                }

                document.getElementById('resYield').innerHTML = htmlYield;
                document.getElementById('resLoan').innerHTML = htmlLoan;
                document.getElementById('resCashflow').innerHTML = htmlCashflow;
                document.getElementById('resultBox').style.display = 'block';
            }
        </script>
    </body>
    </html>
  `);
});

// 2. Giữ lại phần Webhook cũ nếu sau này bạn vẫn muốn dùng kết hợp với Messenger
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode && token && mode === 'subscribe' && token === (process.env.VERIFY_TOKEN || 'prop_review_token_123')) {
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
});

app.post('/webhook', (req, res) => {
  res.status(200).send('EVENT_RECEIVED');
});

// Khởi chạy server
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 Web App đang chạy ở cổng ${PORT}`);
});
