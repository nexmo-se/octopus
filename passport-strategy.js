import LocalStrategy from "passport-local";
import passport from "passport"; //note, passport needs to be 0.5.3 for cookie-session to work
import Vonage from '@vonage/server-sdk';
function passport_auth() {
    passport.use(new LocalStrategy(function asyncverify(api_key, apiSecret, cb) {
        //if (application_id != appID) { return cb(null, false, { message: 'Incorrect Application ID or API Key.' }); }

        const apiKey = api_key
        const vonage = new Vonage({
            apiKey: apiKey,
            apiSecret: apiSecret
        });

        vonage.account.listSecrets(apiKey, async (err, result) => {
            if (!err) {
                //Valid API Secret, Let's go
                return cb(null, { id: "0", username: "Vonage User" })
            } else {
                return cb(null, false, { message: 'Incorrect Application ID or API Key.' })
            }
        });
    }));

    passport.serializeUser(function (user, cb) {
        console.log("Serialized Called")
        process.nextTick(function () {
            cb(null, { id: user.id, username: user.username });
        });
    });

    passport.deserializeUser(function (user, cb) {
        console.log("Deserialized Called", user)
        process.nextTick(function () {
            console.log("next")
            return cb(null, user);
        });
    });


}
export { passport_auth, passport}