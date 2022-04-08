import LocalStrategy from "passport-local";
import passport from "passport";
import Vonage from '@vonage/server-sdk';
function passport_auth(application_id, api_key) {
    passport.use(new LocalStrategy(function verify(appID, apiSecret, cb) {
        if (application_id != appID) { return cb(null, false, { message: 'Incorrect Application ID or API Key.' }); }

        const apiKey = api_key
        const vonage = new Vonage({
            apiKey: apiKey,
            apiSecret: apiSecret
        });

        vonage.account.listSecrets(apiKey, (err, result) => {
            if (!err) {
                //Valid API Secret, Let's go
                return cb(null, { id: "0", username: "Vonage User" })
            } else {
                return cb(null, false, { message: 'Incorrect Application ID or API Key.' })
            }
        });
    }));

    passport.serializeUser(function (user, cb) {
        process.nextTick(function () {
            cb(null, { id: user.id, username: user.username });
        });
    });

    passport.deserializeUser(function (user, cb) {
        process.nextTick(function () {
            return cb(null, user);
        });
    });


}
export { passport_auth, passport}