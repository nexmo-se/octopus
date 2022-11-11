import parsePhoneNumber from 'libphonenumber-js'

export function CountryBlacklist(state){
  this.blacklist_to = function (req, res, next){
    var prefix = req.body.api_key
    state.get(prefix+"blacklist").then((blacklist) => {
        if (!blacklist) {
            next();
        }
        else {
          if (!req.body.to) {next()}
            const phoneNumber = parsePhoneNumber("+" + (req.body.to));
            blacklist = JSON.parse(blacklist);
            if (blacklist.includes(phoneNumber.country)) {
              res.json({"allowed":false,"message":"Country in Blocked List"});
            }
            else {
                next();
            }
        }
    });

  }

  this.blacklist_from = function (req, res, next){
    var prefix = req.body.api_key
    state.get(prefix+"blacklist").then((blacklist) => {
        if (!blacklist) {
            next();
        }
        else {
            console.log("FROM",req.body.from, !req.body.from)
            if (!req.body.from) {next()
            }
            const phoneNumber = parsePhoneNumber("+" + (req.body.from));
            blacklist = JSON.parse(blacklist);
            try{
              if (blacklist.includes(phoneNumber.country)) {
                res.json({"allowed":false,"message":"Country in Blocked List"});
              }
              else {
                  next();
              }
            }catch(e){
              next();
            }
            
            
        }
    });

  }

  this.number_block = function (req, res, next){
    if(req.body.to == "6598629551"){
      res.status(403).send("Number is blocked");
    }else{
      next();
    }

   
  };
}