const express = require('express');
const router = express.Router();
const axios = require('axios');
const { chat } = require('../lib/ai');
const tools = require('../tools/index');
const { executeTool } = require('../tools/executor');
const supabase = require('../lib/supabase');

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;

// ─── Webhook Verification (Meta calls this once during setup) ───────────────
// GET /api/whatsapp/webhook
router.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('WhatsApp webhook verified');
    return res.status(200).send(challenge);
  }

  res.sendStatus(403);
});

// ─── Incoming Messages ───────────────────────────────────────────────────────
// POST /api/whatsapp/webhook
router.post('/webhook', async (req, res) => {
  // Acknowledge immediately — Meta requires 200 within 5 seconds
  res.sendStatus(200);

  try {
    const entry = req.body?.entry?.[0];
    const change = entry?.changes?.[0];
    const message = change?.value?.messages?.[0];

    if (!message || message.type !== 'text') return;

    const from = message.from;         // user's WhatsApp number
    const userText = message.text.body;
    const userId = `wa_${from}`;       // unique ID per WhatsApp user

    // Load this user's recent chat history from Supabase (last 10 messages)
    const { data: history } = await supabase
      .from('messages')
      .select('role, content')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(10);

    const messages = [
      ...(history || []),
      { role: 'user', content: userText },
    ];

    // Run through the same AI pipeline as the mobile app
    let aiMessage = await chat({ messages, tools, tone: 'bhai' }); // WhatsApp = casual tone

    if (aiMessage.tool_calls && aiMessage.tool_calls.length > 0) {
      const toolMessages = [aiMessage];

      for (const toolCall of aiMessage.tool_calls) {
        const toolName = toolCall.function.name;
        const toolArgs = JSON.parse(toolCall.function.arguments || '{}');
        const toolResult = await executeTool(toolName, toolArgs, { userId });

        toolMessages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(toolResult),
        });
      }

      aiMessage = await chat({
        messages: [...messages, ...toolMessages],
        tools: [],
        tone: 'bhai',
      });
    }

    const reply = aiMessage.content;

    // Save to Supabase
    await supabase.from('messages').insert([
      { user_id: userId, role: 'user', content: userText, tone: 'bhai' },
      { user_id: userId, role: 'assistant', content: reply, tone: 'bhai' },
    ]);

    // Send reply back via WhatsApp
    await sendWhatsAppMessage(from, reply);

  } catch (err) {
    console.error('WhatsApp webhook error:', err.message);
  }
});

// ─── Send message via WhatsApp Cloud API ────────────────────────────────────
async function sendWhatsAppMessage(to, text) {
  await axios.post(
    `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`,
    {
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: text },
    },
    {
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json',
      },
    }
  );
}

module.exports = router;
