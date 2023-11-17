import express from 'express'
import WillyClient from './willy-client.js'
import WillySlackBot from './slackbot.js'
import RedisAgent from './redis-agent.js'
import dotenv from 'dotenv'
dotenv.config()

async function main() {
  RedisAgent.initialize({
    // redisUrl: process.env.REDIS_URL || 'redis://default:d3svkL8vr7bk1bCWMnBt0qhvntiGNHFB@redis-16791.c302.asia-northeast1-1.gce.cloud.redislabs.com:16791/0',
    redisUrl: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
  })

  if (!process.env.SLACK_BOT_TOKEN || !process.env.SLACK_APP_TOKEN) {
    throw new Error('Missing slack token')
  }

  const slackBot = new WillySlackBot({
    slackBotToken: process.env.SLACK_BOT_TOKEN,
    slackAppToken: process.env.SLACK_APP_TOKEN,
    reactions: {
      loading: process.env.SLACK_REACTION_LOADING || '',
      success: process.env.SLACK_REACTION_SUCCESS || '',
      failed: process.env.SLACK_REACTION_FAILED || '',
    },
    willyResponseQueue: process.env.RESPONSE_QUEUE_NAME || '',
  } as SlackBotArgs)
  slackBot.listen()

  const app = express()
  const port = process.env.PORT || 8080
  app.use(express.json())
  app.listen(port, () => {
    console.info(`[${new Date().toISOString()}] EXPRESS_APP istening on port ${port}`)
  })

  const willyClient = new WillyClient()
  willyClient.listenQuestion()
}

main().catch((err: Error) => {
  console.error(err)
})
