import pkg from '@slack/bolt'
const { App } = pkg

import WillyClient from './willy-client.js'

class WillySlackBot {
  slackApp: any
  reactions: Reactions
  willyResponseQueue: string

  constructor(args: WillySlackBotArgs) {
    this.slackApp = new App({
      token: args.slackBotToken,
      appToken: args.slackAppToken,
      socketMode: true,
    })

    this.reactions = {
      loading: args.reactions?.loading || 'thinking_face',
      success: args.reactions?.success || 'white_check_mark',
      failed: args.reactions?.failed || 'x',
    }

    this.willyResponseQueue = args.willyResponseQueue || 'queues.answers.slackbot'
  }

  async listen(): Promise<void> {
    console.info(`[${new Date().toISOString()}] SLACK_START_LISTENING`)

    this.slackApp.message(async ({ message }: any) => {
      console.info(
        `[${new Date().toISOString()}] SLACK_RECEIVED_DIRECT_MESSAGE ${JSON.stringify(message)}`,
      )
      const { ts, thread_ts, channel, text } = message as any
      if (!text) {
        return
      }
      this._ack(text, { channel, ts, thread_ts })
    })

    this.slackApp.event('app_mention', async ({ event }: any) => {
      console.info(`[${new Date().toISOString()}] SLACK_RECEIVED_MENTION ${JSON.stringify(event)}`)

      const userIdTag = `<@${process.env.SLACK_BOT_USER_ID}>`
      const { text, ts, channel, thread_ts } = event
      if (!text.includes(userIdTag)) {
        return
      }
      // Extract user prompt
      const prompt = text.replace(userIdTag, '').trim()
      this._ack(prompt, { ts, thread_ts, channel })
    })

    await this.slackApp.start()
    await WillyClient.listenAnswer(this.willyResponseQueue, async (param) => {
      if (param.success) {
        await this._replyAnswer(param.answer as any, param.question, param.extra, param.handlerId)
      } else {
        await this._replyError(param.error as any, param.question, param.extra, param.handlerId)
      }
    })
  }

  /**
   * In case the user is asking follow-up question in thread, try to obtain the previous chat answer from the thread.
   */
  async _findPreviousWillyMessage(
    channel: string,
    thread_ts: string,
  ): Promise<{ parentMessageId: string; handlerId: string } | null> {
    const replies = await this.slackApp.client.conversations.replies({ channel, ts: thread_ts })
    if (replies?.messages) {
      for (let i = replies.messages.length - 1; i >= 0; i--) {
        if (replies.messages[i].user === process.env.SLACK_BOT_USER_ID) {
          // message is sent by this bot
          const text = replies.messages[i].text
          const matches = text ? /.*_ref:(\S*):(\S*)_/.exec(text) : null
          if (matches) {
            return {
              parentMessageId: matches[1],
              handlerId: matches[2],
            }
          }
        }
      }
    }
    return null
  }

  async _replyAnswer(
    answer: WillyAnswer,
    question: WillyQuestion,
    slackMeta: SlackMeta,
    handlerId: string,
  ): Promise<void> {
    await this.slackApp.client.chat.postMessage({
      channel: slackMeta.channel,
      thread_ts: slackMeta.ts,
      text: `${JSON.stringify(answer.response)}\n\n_ref:${answer.messageId}:${handlerId}_`,
    })
    if (this.reactions.success) {
      await this.slackApp.client.reactions.add({
        channel: slackMeta.channel,
        name: this.reactions.success,
        timestamp: slackMeta.ts,
      })
    }
    if (this.reactions.loading) {
      await this.slackApp.client.reactions.remove({
        channel: slackMeta.channel,
        name: this.reactions.loading,
        timestamp: slackMeta.ts,
      })
    }
  }

  async _replyError(
    err: Error,
    question: WillyQuestion,
    slackMeta: SlackMeta,
    handlerId: string,
  ): Promise<void> {
    await this.slackApp.client.chat.postMessage({
      channel: slackMeta.channel,
      thread_ts: slackMeta.ts,
      text: `Error: ${JSON.stringify(err.message)} \nPlease ask again...`,
    })

    if (this.reactions.failed) {
      await this.slackApp.client.reactions.add({
        channel: slackMeta.channel,
        name: this.reactions.failed,
        timestamp: slackMeta.ts,
      })
    }
    if (this.reactions.loading) {
      await this.slackApp.client.reactions.remove({
        channel: slackMeta.channel,
        name: this.reactions.loading,
        timestamp: slackMeta.ts,
      })
    }
  }

  async _ack(prompt: string, slackMeta: SlackMeta) {
    if (prompt.trim().length === 0) {
      return
    }

    let prevAns = undefined
    if (slackMeta.thread_ts) {
      prevAns = await this._findPreviousWillyMessage(slackMeta.channel, slackMeta.thread_ts)
    }

    // Leave loading reaction
    if (this.reactions.loading) {
      const reaction = await this.slackApp.client.reactions.add({
        channel: slackMeta.channel,
        name: this.reactions.loading,
        timestamp: slackMeta.ts,
      })
    }

    const question: WillyQuestion = {
      prompt,
      parentMessageId: prevAns?.parentMessageId,
    }

    await WillyClient.ask(question, {
      responseQueue: this.willyResponseQueue,
      handlerId: prevAns?.handlerId,
      extra: slackMeta,
    })
  }
}

export default WillySlackBot
