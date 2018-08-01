exports.parseCharacter = (message, success, fail) =>  {
    var lines = message.split('\n');
    var splits = lines.map((line) => line.split(': '));
    if (splits.every((split) => split.length === 2)) {
        var attrs = {};
        splits.forEach((split) => {
            let [k, v] = split;
            attrs[k.toLocaleLowerCase()] = v;
        });
        return success(attrs);
    } else {
        return fail({
            splits: splits
        });
    }
}

exports.doPayment = (db, from, to, amount) => {
    return db.update('characters', (characters) => {
        var doTransaction = true;
        return characters
            .updateIn([from['userID'], from['characterName'], 'money'], (x) => {
                if (x >= amount) {
                    return x - amount;
                } else {
                    doTransaction = false;
                    return x;
                }
            })
            .updateIn([to['userID'], to['characterName'], 'money'], (x) => {
                return doTransaction ? x + amount : x;
            });
    });
}

exports.characterName = (db, userID, channelID) => {
    return db.getIn(['users', userID, channelID]);
}
