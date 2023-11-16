import redis from '@redis/client'

class RedisAgent {
  private static _instance: RedisAgent
  client: any

  constructor(args: RedisAgentArg) {
    // create a client for connecting to Redis
    this.client = redis.createClient({
      url: args.redisUrl,
    })

    // set up error handling for the client
    this.client.on('error', (err: Error) => {
      console.error(`Error: ${err}`)
    })
  }

  async connect(): Promise<void> {
    await this.client.connect()
  }

  async enqueue(queueName: string, message: any): Promise<void> {
    // use the RPUSH command to add the message to the end of the list
    await this.client.rPush(queueName, JSON.stringify(message))
  }

  async dequeue(queueName: string): Promise<any> {
    // use the LPOP command to remove the first message from the list
    const message = await this.client.lPop(queueName)
    if (!message) {
      return null
    }
    const result = JSON.parse(message)
    return result
  }

  async get(key: string): Promise<string> {
    return await this.client.GET(key)
  }

  async set(key: string, value: string): Promise<void> {
    await this.client.SETEX(key, 86400, value) // 1 day TTL
  }

  static async initialize(args: RedisAgentArg): Promise<void> {
    RedisAgent._instance = new RedisAgent(args)
    await RedisAgent._instance.connect()
  }

  static getInstance(): RedisAgent {
    if (!RedisAgent._instance) {
      throw new Error('RedisAgent not initialized')
    }
    return RedisAgent._instance
  }
}

export default RedisAgent
