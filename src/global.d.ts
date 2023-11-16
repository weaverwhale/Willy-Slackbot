declare interface SlackBotArgs {
  slackBotToken: string
  slackAppToken: string
  reactions: {
    loading: string
    success: string
    failed: string
  }
  willyResponseQueue: string
}

declare interface SlackMeta {
  ts: string
  channel: string
  thread_ts: string
}

declare interface Reactions {
  loading?: string
  success?: string
  failed?: string
}

declare interface WillySlackBotArgs {
  slackBotToken: string
  slackAppToken: string
  willyResponseQueue: string
  reactions?: Reactions
}

declare interface RedisAgentArg {
  redisUrl: string
}

declare interface WillyQuestion {
  prompt: string
  parentMessageId?: string
  responseQueue?: string
}

declare interface WillyAnswer {
  response: string
  messageId: string
}

declare interface WillyCallbackParam {
  success: boolean
  handlerId: string
  question: WillyQuestion
  answer?: WillyAnswer
  error?: Error
  extra?: any
}

declare type WillyCallback = (param: WillyCallbackParam) => void
