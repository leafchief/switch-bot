const fs = require('fs');
const puppeteer = require('puppeteer');
const {Spinner} = require('cli-spinner');
const notifier = require('node-notifier');

const {url, email, password, credit, cvv} = JSON.parse(fs.readFileSync('settings.json'));

const spinner = new Spinner('%s');
spinner.setSpinnerString(18);
spinner.start();

const target = async () => {
  spinner.setSpinnerTitle('%s checking…');

  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto(url);

  await page.waitFor('[data-test="shipping"]');
  
  const act = await page.$('[data-test="shippingATCButton"]');
  await browser.close();

  return Boolean(act);
};


const target2 = async() => {
  spinner.setSpinnerTitle('%s adding to cart…');

  const browser = await puppeteer.launch({
    defaultViewport: null,
    headless: false
  });
  const page = await browser.newPage();
  await page.goto(url);

  try {
    await page.waitFor('[data-test="shipping"]');
    
    const act = await page.$('[data-test="shippingATCButton"]');
    await act.click();
    const decline = await page.waitFor('[data-test="espModalContent-declineCoverageButton"]');
    await decline.click()

    const cart = await page.waitFor('[data-test="addToCartModalViewCartCheckout"]');
    await cart.click();

    const ready = await page.waitFor('[data-test="checkout-button"]');
    await ready.click();

    spinner.setSpinnerTitle('%s logging in…');
    const user = await page.waitFor('#username');
    await user.type(email)
    await page.type('#password', password);
    await page.click('#login')

    spinner.setSpinnerTitle('%s verifying credit card…');
    const cc = await page.waitFor('#creditCardInput-cardNumber');
    await cc.type(credit);
    await page.click('[data-test="verify-card-button"]');

    const securityCode = await page.waitFor('#creditCardInput-cvv');
    await securityCode.type(cvv);

    const save = await page.waitFor('[data-test="save-and-continue-button"]');
    await save.click();

    await page.waitForSelector('[data-test="spinnerOverlayContainer"]', {visible: false});

    spinner.setSpinnerTitle('%s placing order');
    const place = await page.waitFor('[data-test="placeOrderButton"]');
    
    await page.waitFor(1000);
    await place.click();

    spinner.stop(true);

    notifier.notify({
      title: 'switch-bot',
      message: 'Switch purchased!!!!',
    });
  } catch (e) {
    spinner.stop(true);
    console.error('ERROR', e.message);

    notifier.notify({
      title: 'switch-bot',
      message: 'Switch available, error attempting purchase.',
      sound: true,
    });
  } 
};

const run = () => target()
  .then((success) => {
    if (!success) {
      spinner.setSpinnerTitle('%s checking again in 10 seconds…')
      setTimeout(run, 10000);
    } else {
      target2();
    }
  });

run();

process.on('SIGINT', () => {
  spinner.stop(true);
  process.exit(0);
});

process.on('SIGTERM', () => {
  spinner.stop(true);
  process.exit(0);
});