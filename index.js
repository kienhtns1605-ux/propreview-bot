const express = require('express');
const bodyParser = require('body-parser');
const app = express();
app.use(bodyParser.json());

const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "prop_review_token_123";

// Xác thực Webhook với Facebook
app.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token === VERIFY_TOKEN) {
        res.status(200).send(challenge);
    } else {
        res.sendStatus(403);
    }
});

// Nhận tin nhắn từ Messenger
app.post('/webhook', (req, res) => {
    const body = req.body;
    if (body.object === 'page') {
        body.entry.forEach(entry => {
            entry.messaging.forEach(event => {
                if (event.message && event.message.text) {
                    handleMessage(event.sender.id, event.message.text);
                }
            });
        });
        res.status(200).send('EVENT_RECEIVED');
    } else {
        res.sendStatus(404);
    }
});

// Xử lý logic tính toán BĐS
function handleMessage(senderId, text) {
    // Ví dụ khách nhắn theo cú pháp: "Review: 2500, 12, 1.5, 1500" tương ứng (Giá mua tỷ, Tiền thuê triệu, Phí triệu, Vay tỷ)
    // Hoặc bạn có thể yêu cầu Bot phân tích dữ liệu dạng text tự do.
    // Ở đây ta làm mẫu tính toán cơ bản:
    console.log("Nhận tin nhắn:", text);
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Bot đang chạy ở cổng ${PORT}`));
