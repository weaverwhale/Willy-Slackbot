import RedisAgent from './redis-agent.js'
import crypto from 'crypto'

class WillyClient {
  handlerId: string

  constructor() {
    this.handlerId = this._obtainHandlerId()
  }

  /**
   * Returns a hash string
   */
  private _obtainHandlerId(): string {
    const hash = crypto.createHash('sha256')
    hash.update(new Date().getMilliseconds().toString())
    const hashed = hash.digest('hex')
    return hashed.substring(0, 10)
  }

  /**
   * Ask Willy Asyncrhonously. Requests will be enqueued to a queue system for handlers to process.
   * The result will be returned through an answer queue provided by caller.
   */
  static async ask(
    question: WillyQuestion,
    opts: { responseQueue: string; handlerId?: string; extra?: any },
  ): Promise<void> {
    const { responseQueue, handlerId, extra } = opts

    if (handlerId) {
      await RedisAgent.getInstance().enqueue(`queues.questions.handler.${handlerId}`, {
        question,
        extra,
        responseQueue,
      })
    } else {
      await RedisAgent.getInstance().enqueue(`queues.questions.handler.common`, {
        question,
        extra,
        responseQueue,
      })
    }
  }

  /**
   * Start listening to queues. Note each client listens to 2 queues: Common Queue and Account Specific Queue.
   * The account specific queue is used in case that a root question is processed by a specific account previously
   * therefore its follow-up must also be processed by the same account.
   */
  async listenQuestion(): Promise<void> {
    console.info(`[${new Date().toISOString()}] WILLY_START_LISTEN_QUEUE <${this.handlerId}>`)
    while (true) {
      await this._popAndHandle(`queues.questions.handler.common`)
      await this._popAndHandle(`queues.questions.handler.${this.handlerId}`)
      await new Promise((r) => setTimeout(r, 1000))
    }
  }

  static async listenAnswer(answerQueueName: string, callback: WillyCallback): Promise<void> {
    while (true) {
      let item = await RedisAgent.getInstance().dequeue(answerQueueName)
      if (item) {
        await callback(item)
      }
      await new Promise((r) => setTimeout(r, 1000))
    }
  }

  /**
   * Pops one item from queue and try to handle it.
   */
  private async _popAndHandle(queueName: string): Promise<void> {
    let item = await RedisAgent.getInstance().dequeue(queueName)
    if (item) {
      try {
        const answer = await this._handleAsk(item.question)
        await RedisAgent.getInstance().enqueue(item.responseQueue, {
          success: true,
          answer,
          question: item.question,
          extra: item.extra,
          handlerId: this.handlerId,
        })
      } catch (err) {
        await RedisAgent.getInstance().enqueue(item.responseQueue, {
          success: false,
          error: err,
          question: item.question,
          extra: item.extra,
          handlerId: this.handlerId,
        })
      }
    }
  }

  /**
   * Handle a question
   */
  private async _handleAsk(question: WillyQuestion): Promise<WillyAnswer> {
    try {
      console.info(
        `[${new Date().toISOString()}] WILLY_REQUEST <${this.handlerId}> ${JSON.stringify({
          question,
        })}`,
      )

      const result = await fetch('https://app.triplewhale.com/api/v2/willy/answer-nlq-question', {
        method: 'POST',
        body: JSON.stringify({
          stream: false,
          shopId: 'madisonbraids.myshopify.com',
          messageId: question.parentMessageId || this.handlerId,
          question: question.prompt,
        }),
      })
        .then((res) => res.json())
        .catch((err) => {
          console.error(err)
          throw err
        })

      console.info(
        `[${new Date().toISOString()}] WILLY_RESPONSE <${this.handlerId}> ${JSON.stringify(
          result,
        )}`,
      )

      return {
        response: result.text,
        messageId: result.id,
      }
    } catch (err) {
      console.info(
        `[${new Date().toISOString()}] WILLY_ERROR <${this.handlerId}> ${JSON.stringify({
          err,
        })}`,
      )
      throw err
    }
  }
}

export default WillyClient
