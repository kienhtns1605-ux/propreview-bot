const express = require('express');
const app = express();

app.use(express.json());

// 1. Endpoint xác minh Webhook với Meta (Facebook)
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'prop_review_token_123';

  if (mode && token) {
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('WEBHOOK_VERIFIED');
      return res.status(200).send(challenge);
    } else {
      return res.sendStatus(403);
    }
  }
  res.sendStatus(400);
});

// 2. Endpoint nhận tin nhắn từ Messenger
app.post('/webhook', async (req, res) => {
  const body = req.body;

  if (body.object === 'page') {
    for (const entry of body.entry) {
      const webhookEvent = entry.messaging ? entry.messaging[0] : null;
      if (!webhookEvent) continue;

      const senderPsid = webhookEvent.sender ? webhookEvent.sender.id : null;

      // Bỏ qua tin nhắn do chính Bot gửi ra
      if (webhookEvent.message && !webhookEvent.message.is_echo && webhookEvent.message.text) {
        const text = webhookEvent.message.text.trim();
        console.log(`📩 Nhận tin nhắn từ [${senderPsid}]: "${text}"`);

        // Xử lý và tính toán BĐS
        const replyText = processRealEstateQuery(text);
        
        // Gửi câu trả lời về Messenger
        await sendMessengerMessage(senderPsid, replyText);
      }
    }
    res.status(200).send('EVENT_RECEIVED');
  } else {
    res.sendStatus(404);
  }
});

// 3. Hàm logic tính toán BĐS
function processRealEstateQuery(text) {
  // Trợ giúp nếu người dùng chào hỏi
  if (/^(hi|hello|xin chào|chào|help|trợ giúp)$/i.test(text)) {
    return `🏢 *PROPREVIEW AI - BOT ĐÁNH GIÁ BĐS*\n\n` +
           `Hãy gửi cú pháp:\n` +
           `👉 **Giá mua, Tiền thuê, Tiền vay**\n\n` +
           `*Ví dụ:* \`2500, 12, 1500\`\n` +
           `(Ý nghĩa: Giá mua 2.5 tỷ, Thuê 12 triệu/tháng, Vay ngân hàng 1.5 tỷ)\n\n` +
           `*Mặc định định mức vay:* Lãi suất 9.5%/năm, thời hạn 20 năm.`;
  }

  // Lấy tất cả các số trong tin nhắn
  const numbers = text.match(/[-+]?[0-9]*\.?[0-9]+/g);

  if (!numbers || numbers.length < 2) {
    return `⚠️ *Sai cú pháp!*\n\nVui lòng gửi theo dạng: **Giá_mua, Tiền_thuê, Tiền_vay**\nVí dụ: \`2500, 12, 1500\` (Tương ứng: 2.5 tỷ, 12 triệu thuê, vay 1.5 tỷ).`;
  }

  const priceGiaMua = parseFloat(numbers[0]);    // Đơn vị: triệu (VD: 2500 = 2.5 tỷ)
  const rentTienThue = parseFloat(numbers[1]);   // Đơn vị: triệu/tháng (VD: 12 = 12 triệu)
  const loanTienVay = numbers[2] ? parseFloat(numbers[2]) : 0; // Đơn vị: triệu

  if (priceGiaMua <= 0) {
    return `⚠️ Giá mua BĐS phải lớn hơn 0!`;
  }

  // --- THÔNG SỐ TÍNH TOÁN ---
  // Tỷ suất dòng tiền thô (Cap Rate / Yield)
  const annualRent = rentTienThue * 12;
  const yieldPercent = (annualRent / priceGiaMua) * 100;

  // Tính tiền vay ngân hàng (Mặc định: 9.5%/năm, 20 năm = 240 tháng)
  const annualInterestRate = 0.095; 
  const monthlyInterestRate = annualInterestRate / 12;
  const totalMonths = 240;

  let monthlyLoanPayment = 0; // Tổng trả hàng tháng (Gốc + Lãi tháng đầu)
  let principalPayment = 0;
  let interestPayment = 0;

  if (loanTienVay > 0) {
    principalPayment = loanTienVay / totalMonths; // Gốc đều
    interestPayment = loanTienVay * monthlyInterestRate; // Lãi tháng đầu
    monthlyLoanPayment = principalPayment + interestPayment;
  }

  // Dòng tiền ròng thực tế hàng tháng
  const netCashflow = rentTienThue - monthlyLoanPayment;

  // --- TẠO NỘI DUNG PHẢN HỒI ---
  let response = `📊 *KẾT QUẢ PHÂN TÍCH BĐS*\n` +
                 `━━━━━━━━━━━━━━━━━━━\n` +
                 `💵 *Giá mua:* ${priceGiaMua >= 1000 ? (priceGiaMua/1000).toFixed(2) + ' tỷ' : priceGiaMua + ' triệu'}\n` +
                 `🏠 *Tiền thuê:* ${rentTienThue} triệu/tháng\n` +
                 `📈 *Tỷ suất dòng tiền (Yield):* ${yieldPercent.toFixed(2)}%/năm\n`;

  if (loanTienVay > 0) {
    response += `💳 *Khoản vay:* ${loanTienVay >= 1000 ? (loanTienVay/1000).toFixed(2) + ' tỷ' : loanTienVay + ' triệu'} (9.5%/năm, 20 năm)\n` +
                `💸 *Gốc + Lãi trả NH (tháng đầu):* ~${monthlyLoanPayment.toFixed(2)} triệu/tháng\n` +
                `━━━━━━━━━━━━━━━━━━━\n`;
    
    if (netCashflow >= 0) {
      response += `🟢 *Dòng tiền RỒNG:* +${netCashflow.toFixed(2)} triệu/tháng (DƯ TRẢ LÃI)`;
    } else {
      response += `🔴 *Dòng tiền RỒNG:* ${netCashflow.toFixed(2)} triệu/tháng (CẦN BÙ THÊM)`;
    }
  } else {
    response += `━━━━━━━━━━━━━━━━━━━\n` +
                `🟢 *Dòng tiền RỒNG:* +${rentTienThue} triệu/tháng (Không vay ngân hàng)`;
  }

  return response;
}

// 4. Hàm gọi Facebook Graph API gửi tin nhắn trả lời
async function sendMessengerMessage(senderPsid, responseText) {
  const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;

  if (!PAGE_ACCESS_TOKEN) {
    console.error('❌ LỖI: Chưa cấu hình biến PAGE_ACCESS_TOKEN trên Render Environment!');
    return;
  }

  const requestBody = {
    recipient: { id: senderPsid },
    message: { text: responseText }
  };

  try {
    const response = await fetch(`https://graph.facebook.com/v18.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();

    if (response.ok && !data.error) {
      console.log(`✅ Đã gửi tin nhắn thành công tới PSID: ${senderPsid}`);
    } else {
      console.error('❌ LỖI TỪ FACEBOOK API:', JSON.stringify(data.error, null, 2));
    }
  } catch (error) {
    console.error('❌ LỖI KẾT NỐI MẠNG KHI GỬI TIN NHẮN:', error);
  }
}

// 5. Khởi chạy Server
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 Bot đang chạy ở cổng ${PORT}`);
});
