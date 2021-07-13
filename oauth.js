const puppeteer = require('puppeteer')
const querystring = require('querystring')
const url = require('url')

;(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--window-size=800,700'],
  })
  const page = await browser.newPage()
  await page.goto(
    'https://uswest1-auth-console.fauna.com/oauth/start?provider_name=github&redirect_url=https://dashboard.fauna.com/auth/oauth/callback'
  )

  const callbackResponse = await page.waitForResponse(
    (resp) => {
      return resp
        .url()
        .includes('https://uswest1-auth-console.fauna.com/oauth/callback?code')
    },
    { timeout: 1000 * 60 * 5 } // 5 minutes
  )

  const { location } = callbackResponse.headers()
  const { query } = url.parse(location)
  const { credentials } = querystring.parse(query)

  console.info(Buffer.from(credentials, 'base64').toString)

  // await browser.close()
})()
