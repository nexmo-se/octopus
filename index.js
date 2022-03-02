import { neru } from 'neru-alpha';
import hpm from 'http-proxy-middleware';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import st from 'serve-static';
import parsePhoneNumber from 'libphonenumber-js'
import isoCountry from "i18n-iso-countries";
import cons from 'consolidate';

//emulate js __dirname as we are in es6
const __dirname = dirname(fileURLToPath(import.meta.url));
var path = __dirname + '/views/';
const app_id = process.env['API_APPLICATION_ID']; //get application_id
const api_key = process.env['API_ACCOUNT_ID']; //get api key
const { createProxyMiddleware, fixRequestBody, Filter, Options, RequestHandler } = hpm;
const router = neru.Router();
const session = neru.getSessionById('neru-sms-proxy-'+app_id);
const instanceState = session.getState();
//console.log(process.env) //let's check what process env variables are available to us

//load the css, js, fonts to static paths so it's easier to call in template
router.use("/fonts", st(join(__dirname, "node_modules/bootstrap/fonts")));
router.use("/css", st(join(__dirname, "node_modules/bootstrap/dist/css")));
router.use("/css", st(join(__dirname, "node_modules/bootstrap-select/dist/css")));
router.use("/css", st(join(__dirname, "node_modules/bootstrap-select-country/dist/css")));
router.use("/js", st(join(__dirname, "node_modules/bootstrap/dist/js")));
router.use("/js", st(join(__dirname, "node_modules/bootstrap-select/dist/js")));
router.use("/js", st(join(__dirname, "node_modules/bootstrap-select-country/dist/js")));
router.use("/js", st(join(__dirname, "node_modules/jquery/dist")));


router.use('/sms', [
    //custom middleware to check if "to" is blacklisted
    (req, res, next) => {
        instanceState.get("blacklist").then((blacklist) => {
            console.log(blacklist);
            if (!blacklist) {
                console.log("No Blacklist, let's continue")
                next();
            }
            else {
                const phoneNumber = parsePhoneNumber("+" + (req.body.to));
                blacklist = JSON.parse(blacklist);
                if (blacklist.includes(phoneNumber.country)) {
                    res.status(403).send("Country in Blocked List");
                }
                else {
                    next();
                }
            }
        });

    },
    //http proxy middleware
    createProxyMiddleware({
        target: 'https://rest.nexmo.com', changeOrigin: true,
        onProxyReq: (proxyReq, req, res) => {
            console.log("proxy")
            fixRequestBody(proxyReq, req); //this fixes the body to orignal format before modifed by body-parer
        }

    })
])

// router.get('/login', async (req, res, next) => {
    //write passport custom auth
// });

//see it service is live
router.get('/', async (req, res, next) => {
    console.log("default route / has reached.")
    res.send("Vonage Proxy Service");
});

//Set Blacklist
router.post('/set_blacklist', async (req, res, next) => {
    console.log(req.body.data)
    var blacklist = req.body.data
    if(!blacklist) blacklist = [];
    await instanceState.set("blacklist", JSON.stringify(blacklist));
    blacklist = blacklist.map(i => i + ": " + isoCountry.getName(i, "en", { select: "official" }));
    res.status(200).send(blacklist)
});

//Get Blacklist
router.get('/blacklist', async (req, res, next) => {
    var blacklist = await instanceState.get("blacklist");
    console.log(blacklist)
    res.send(JSON.parse(blacklist))
});

//Load Conf page
router.get('/conf', async (req, res, next) => {
    //use consolidate js to load ejs file since we don't have access to express
    var blacklist = await instanceState.get("blacklist");
    if(!blacklist) blacklist = "[]";
    blacklist = JSON.parse(blacklist);
    var blacklist_selected = blacklist.join(",");
    var blacklist_with_name = blacklist.map(i => i + ": " + isoCountry.getName(i, "en", { select: "official" }));
    console.log(blacklist);
    cons.ejs(path + "conf.ejs", { blacklist_selected: blacklist_selected, blacklist_with_name: blacklist_with_name }, function (err, html) {
        if (err) throw err;
        res.send(html);
    });
});

export { router };