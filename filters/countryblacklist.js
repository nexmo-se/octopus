import parsePhoneNumber from 'libphonenumber-js'

export function CountryBlacklist(state){
  this.test = "123";
  this.blacklist_to = function (req, res, next){
    state.get("blacklist").then((blacklist) => {
        if (!blacklist) {
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

  }

  this.blacklist_from = function (req, res, next){
    state.get("blacklist").then((blacklist) => {
        if (!blacklist) {
            next();
        }
        else {
            const phoneNumber = parsePhoneNumber("+" + (req.body.from));
            blacklist = JSON.parse(blacklist);
            if (blacklist.includes(phoneNumber.country)) {
                res.status(403).send("Country in Blocked List");
            }
            else {
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