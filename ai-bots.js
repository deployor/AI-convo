require('dotenv').config();
const express = require('express');
const axios = require('axios');
const { App } = require('@slack/bolt');

const app = express();
app.use(express.json());

// init the slack app with a single bot token and signing secret
const slackApp = new App({
  token: process.env.BOT_TOKEN,
  signingSecret: process.env.BOT_SIGNING_SECRET
});

let isActive = false;
let threadTs = null;
let currentTurn = 'AI1' // start with ai1
const OWNER_ID = 'U083T3ZP6AV' // admin slack user id

const AI1_USERNAME = 'BeansAI';
const AI1_ICON_URL = 'https://files.catbox.moe/vim76w.png';

const AI2_USERNAME = 'BreadAI';
const AI2_ICON_URL = 'https://files.catbox.moe/8l6qb6.png';

// call the ai endpoint
async function callAI(message) {
  const res = await axios.post("https://ai.hackclub.com/chat/completions/", {
    messages: [{ role: "user", content: message }]
  }, { headers: { "Content-Type": "application/json" } });

  return res.data.choices?.[0]?.message?.content || "hmm..."
}

// function to continue the conversation
async function continueConversation(text, channel, thread_ts) {
  const response = await callAI(text);
  await slackApp.client.chat.postMessage({
    channel,
    thread_ts,
    text: response,
    username: currentTurn === 'AI1' ? AI1_USERNAME : AI2_USERNAME,
    icon_url: currentTurn === 'AI1' ? AI1_ICON_URL : AI2_ICON_URL
  });

  // switch turns
  currentTurn = currentTurn === 'AI1' ? 'AI2' : 'AI1';

  // Continue the conversation
  if (isActive) {
    setTimeout(() => continueConversation(response, channel, thread_ts), 1000);
  }
}

// listen for messages to start the convo
slackApp.event('message', async ({ event, client }) => {
  if (event.user !== OWNER_ID || event.bot_id) return;

  if (event.text === 'i like ai') {
    isActive = true;
    threadTs = null;

    const res = await client.chat.postMessage({
      channel: event.channel,
      text: "really, i like it too.",
      username: AI1_USERNAME,
      icon_url: AI1_ICON_URL
    });

    threadTs = res.ts;

    // ai1 starts the conversation in the thread
    await continueConversation("hello", event.channel, threadTs);
  }

  if (event.text === 'STOP') {
    isActive = false;
    threadTs = null;
  }
});

// listen for messages to continue the conversation
slackApp.event('message', async ({ event }) => {
  if (!isActive || event.thread_ts !== threadTs || event.bot_id !== process.env.BOT_ID) return;

  const text = event.text;
  setTimeout(() => continueConversation(text, event.channel, threadTs), 1000);
});

// start the server
const PORT = process.env.PORT || 3000;
slackApp.start(PORT).then(() => {
  console.log(`server is running on port ${PORT} Ya Gotta use /slack/events for the event listener!`)
}).catch((error) => {
  console.error('errorrrrrrr starting app:', error)
});
