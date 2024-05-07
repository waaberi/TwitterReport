const puppeteer = require("puppeteer-extra");
const readline = require("readline");
const { setTimeout } = require("timers/promises");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

function askQuestion(query) {
    return new Promise((resolve) => rl.question(query, resolve));
}

async function reportTweet(page, tweetUrl) {
    await page.goto(tweetUrl);

    await page.waitForSelector('div[data-testid="caret"]');
    await page.click('div[data-testid="caret"]');
    await page.waitForSelector('div[data-testid="report"]');
    await page.click('div[data-testid="report"]');

    await page.waitForSelector(
        'input[name="single-choice"][aria-posinset="1"]'
    );
    await page.click('input[name="single-choice"][aria-posinset="1"]');
    await page.waitForSelector('div[data-testid="ChoiceSelectionNextButton"]');
    await page.click('div[data-testid="ChoiceSelectionNextButton"]');

    await page.waitForFunction(
        () => document.querySelector('h1#modal-header').innerText === 'Hate',
        { timeout: 1000 }
    );

    await page.waitForSelector(
        'input[name="single-choice"][aria-posinset="2"]'
    );
    await page.click('input[name="single-choice"][aria-posinset="2"]');
    await page.waitForSelector('div[data-testid="ChoiceSelectionNextButton"]');
    await page.click('div[data-testid="ChoiceSelectionNextButton"]');

    // Leave the page
    await page.goBack();
    console.log("Reported!");
}

async function main() {
    const username = await askQuestion("Please enter the Twitter username: ");
    const numTweets = await askQuestion(
        "Please enter the number of tweets you want to list: "
    );
    const numTweetsInt = parseInt(numTweets);
    const repliesOption = await askQuestion(
        "Do you want to look through replies? (yes/no): "
    );
    const additionalTweets = await askQuestion(
        "Please enter additional tweet URLs to add, separated by commas: "
    );
    const additionalTweetsArray = additionalTweets
        .split(",")
        .map((url) => url.trim());

    const browser = await puppeteer.launch({ headless: false });
    console.log("Please log in to Twitter.");
    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(60000);
    await page.goto("https://twitter.com/login");
    await page.waitForNavigation({ waitUntil: "networkidle2" });

    console.log("Fetching links...");
    await page.goto(
        `https://twitter.com/${username}${
            repliesOption.toLowerCase() === "yes" ? "/with_replies" : ""
        }`
    );
    await setTimeout(3000);

    let tweetsArray = [...additionalTweetsArray];
    while (tweetsArray.length < numTweetsInt) {
        const newTweets = await page.evaluate(
            (username) =>
                Array.from(
                    document.querySelectorAll('article[data-testid="tweet"]'),
                    (element) => {
                        const anchor = element.querySelector(
                            'a[href*="/status/"]'
                        );
                        return anchor &&
                            anchor.href
                                .toLowerCase()
                                .includes(
                                    `twitter.com/${username.toLowerCase()}/status/`
                                )
                            ? anchor.href
                            : null;
                    }
                ).filter(Boolean),
            username
        );
        tweetsArray = [...tweetsArray, ...newTweets];
        await page.evaluate("window.scrollTo(0, document.body.scrollHeight)");
        await setTimeout(3000);
    }

    tweetsArray = tweetsArray.filter((e) => e != "");
    console.log("Checking tweets for violations...");
    for (const tweetUrl of tweetsArray) {
        console.log(`Reporting tweet: ${tweetUrl}`);
        await reportTweet(page, tweetUrl);
    }

    await browser.close();
    console.log(`All done.`);

    rl.close();
}

main();
