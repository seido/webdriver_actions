import webdriver from "selenium-webdriver";
import edge from "selenium-webdriver/edge";
import chrome from "selenium-webdriver/chrome";
import firefox from "selenium-webdriver/firefox";
import safari from "selenium-webdriver/safari";
import sharp from "sharp";
import os from "os"

type BrowserType = "Edge" | "Chrome" | "Firefox" | "Safari"

const createEdgeDriver = async ()=> {
    const op = new edge.Options()
        .headless()
        .addArguments(
            "--lang=ja",
            "--disable-gpu")
        .windowSize({width:1200,height:800});
    const driver = await new webdriver.Builder()
        .setEdgeOptions(op)
        .forBrowser(webdriver.Browser.EDGE)
        .build();
    return driver;
}

const createFirefoxDriver = async ()=> {
    let path;
    if(os.platform()==='win32') {
        path = process.env.GECKOWEBDRIVER && (process.env.GECKOWEBDRIVER + '\\geckodriver.exe');
    } else {
        path = process.env.GECKOWEBDRIVER && (process.env.GECKOWEBDRIVER + '/geckodriver');
    }
    const service = new firefox.ServiceBuilder(path);
    const op = new firefox.Options()
        .headless()
        .windowSize({width:1200,height:800})
        .setPreference("intl.accept_languages","ja")
        .addArguments(
            "--disable-gpu");
    const driver = await new webdriver.Builder()
        .setFirefoxOptions(op)
        .setFirefoxService(service)
        .forBrowser(webdriver.Browser.FIREFOX)
        .build();
    return driver;
}

const createSafariDriver = async ()=> {
    const op = new safari.Options();
    const driver = await new webdriver.Builder()
        .setSafariOptions(op)
        .forBrowser(webdriver.Browser.SAFARI)
        .build();
    await driver.manage().window().setRect({x:0,y:0,width:1200,height:800});
    return driver;
}

const createChromeDriver = async ()=> {
    const op = new chrome.Options()
        .headless()
        .windowSize({width:1200,height:800})
        .addArguments(
            "--lang=ja",
            "--disable-gpu");
    const driver = await new webdriver.Builder()
        .setChromeOptions(op)
        .forBrowser(webdriver.Browser.CHROME)
        .build();
    return driver;
}

const unionImages = async (images:Buffer[]):Promise<sharp.Sharp> => {
    if(images.length==1) {
        return sharp(images[0]);
    }
    let height = 0;
    let width = 0;
    const options:sharp.OverlayOptions[] = [];
    for (const img of images) {
        const s = sharp(img);
        const meta = await s.metadata();
        width = Math.max(width, meta.width||0);
        options.push({
            input:img,
            gravity:sharp.gravity.northwest,
            left:0,
            top:height
            });
        height += meta.height||0;
    }
    return sharp({create:{width,height,channels:3,background:"#FFF"}}).composite(options);
}

const takeScreenshot = async (driver:webdriver.WebDriver, fileName:string) => {
    const body = await driver.findElement(webdriver.By.css("body"));
    let scrolledY = 999999;
    let windowHeight: number = await driver.executeScript("return window.innerHeight");
    let images:Buffer[] = [];
    let latestY = 0;
    do {
        const binary = await driver.takeScreenshot();
        const buffer = Buffer.from(binary, 'base64');
        let image: sharp.Sharp;
        if(scrolledY<windowHeight) {
            const tmp = sharp(buffer);
            const meta = await tmp.metadata();
            if(meta.height!<=scrolledY) {
                break;
            }
            image = await tmp
                .extract({left:0,width:meta.width!,top:meta.height!-scrolledY,height:scrolledY})
        } else {
            image = sharp(buffer);
        }
        images.push(await image.toBuffer());
        await driver.executeScript("window.scrollBy(0, window.innerHeight)");
        const newY: number = await driver.executeScript("return window.scrollY");
        scrolledY = newY-latestY;
        latestY = newY;
        const latestWindowHeight: number = await driver.executeScript("return window.innerHeight");
        if (latestWindowHeight > windowHeight) {
            windowHeight = latestWindowHeight;
            images=[];
            scrolledY = 999999;
            latestY = 0;
            await driver.executeScript("window.scrollTo(0, 0)");
        } else {
            if(scrolledY<=0) {
                break;
            }
        }
    } while (true);
    await (await unionImages(images)).toFile(fileName + ".png");
}

const main = async (browserType:BrowserType,callback:(driver:webdriver.WebDriver,browserType:BrowserType)=>Promise<void>) => {
    console.log("START main");
    let driver:webdriver.WebDriver;
    switch(browserType) {
        case "Chrome":
            driver = await createChromeDriver();
            break;
        case "Edge":
            driver = await createEdgeDriver();
            break;
        case "Firefox":
            driver = await createFirefoxDriver();
            break;
        case "Safari":
            driver = await createSafariDriver();
            break;
    }
    try{
        await callback(driver, browserType);
    }
    finally{
        await driver.quit();
    }
    console.log("END main");
}


let browsers : BrowserType[] = ["Edge","Chrome","Firefox","Safari"];

if(process.argv.length>2) {
    browsers = process.argv.slice(2) as BrowserType[];
}

console.log("browsers", browsers);

browsers.forEach((b)=>{
    main(b, async (driver,browserType)=>{
        await driver.get("https://www.npmjs.com/package/color");
        await takeScreenshot(driver, `npmjs_${browserType}`);
        await driver.get("https://www.amazon.co.jp/");
        await takeScreenshot(driver, `amazon_${browserType}`);
        await driver.get("https://www.yahoo.co.jp/");
        await takeScreenshot(driver, `yahoo_${browserType}`);
        await driver.get("https://www.apple.com/jp");
        await takeScreenshot(driver, `apple_${browserType}`);
        await driver.get("https://b.hatena.ne.jp/");
        await takeScreenshot(driver, `hatena_${browserType}`);
        await driver.get("https://qiita.com/");
        await takeScreenshot(driver, `qiita_${browserType}`);
    }).then(() => {
        console.log("finished");
    });
})