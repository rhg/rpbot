//3rd party
Discord = require('discord.io');
const logger = require('winston');
let {
    Map,
    fromJS,
    Set,
    List
} = require('immutable');

// mine
const {
    parseCharacter,
    characterName,
    doPayment
} = require('./util.js');
const auth = require('./auth.json');
const {
    CHARACTERS
} = require('./constants.json');
var state = fromJS(require('./state.json'));

// node
const {
    inspect
} = require('util');
const process = require('process');
const {
    writeFileSync
} = require('fs');

var saveStateSync = () => {
    logger.info(`writing state: ${JSON.stringify(state)}`);
    writeFileSync('state.json', JSON.stringify(state));
}

var queueDelete = (channelID, evt) => {
    setTimeout(() => {
        bot.deleteMessage({
            channelID: channelID,
            messageID: evt.d.id
        });
    }, 5000);
}

var describeCharacter = (charData) => {
    return charData.reduce((acc, V, K) => {
        logger.info(inspect(acc));
        return acc.push(`${K.toLocaleUpperCase()} - ${V}`);
    }, List()).join('\n');
}

var handleDesc = (db, rest, userID, channelID, evt) => {
    let charName = rest.join(' ').toLocaleLowerCase();
    let characters = db.getIn(['channels', channelID, 'characters']);
    console.log(require('util').inspect(characters, {
        depth: null
    }));
    let character = characters.find((charInfo) => {
        console.log(require('util').inspect(charInfo, {
            depth: null
        }));
        return charInfo.get('name').toLocaleLowerCase().startsWith(charName);
    });
    if (character === undefined) {
        bot.sendMessage({
            to: userID,
            message: `No Such Character In Channel: ${charName}`
        });
        queueDelete(channelID, evt);
    } else {
        console.log(require('util').inspect(character, {
            depth: null
        }));
        let charData = db.getIn(['characters', character.get('userID'), character.get('name'), 'attrs']);
        bot.sendMessage({
            to: userID,
            message: describeCharacter(charData)
        });
    }
}

var handleSet = (db, rest, userID, channelID) => {
    // find all characters
    var chars = db.getIn(['characters', userID]);
    if (chars === undefined) {
        bot.sendMessage({
            to: userID,
            message: 'No Characters'
        });
        return db;
    }

    let character = rest.join(' ');
    var char = chars.find((V, K) => K.toLocaleLowerCase().startsWith(character.toLocaleLowerCase()));
    if (char === undefined) {
        bot.sendMessage({
            to: userID,
            message: `No Such Character: ${character}`
        });
        return db;
    } else {
        return db.setIn(['users', userID, channelID], char.getIn(['attrs', 'name']))
            .updateIn(['channels', channelID, 'characters'], [], (l) => Set(l).add(Map({
                name: char.getIn(['attrs', 'name']),
                userID: userID
            })));
    }
}

var handleCommand = (state2, args) => {
    let [_, userID, channelID, message, evt] = args;
    let [command, ...rest] = message.substring(1).split(' ');
    queueDelete(channelID, evt);
    switch (command) {
        case 'set':
            return handleSet(state2, rest, userID, channelID);
        case 'desc':
            handleDesc(state, rest, userID, channelID, evt);
            return state2;
        case 'pay':
            let toUserID = rest[0].substring(2, rest[0].length - 1);
            let from = {
                userID: userID,
                characterName: characterName(state2, userID, channelID)
            };
            let toCharacterName = characterName(state2, toUserID, channelID);
            if (state2.getIn(['characters', toUserID, toCharacterName])) {
                let to = {
                    userID: toUserID,
                    characterName: toCharacterName
                };
                return doPayment(state2, from, to, parseInt(rest[1]));
            } else {
                return state2;
            }
        default:
            bot.sendMessage({
                to: userID,
                message: `No such command: ${command}`
            });
            return state2;
    }
}

var addCharacter = (input, args) => {
    // FIXME: don't allow to set money
    let [_, userID, _2, message, evt] = args;
    return parseCharacter(message, (attrs) => {
        var v = attrs['name'];
        if (v !== undefined) {
            return Map(input).setIn(['characters', userID, attrs['name'], 'attrs'], Map(attrs))
                .setIn(['characters', userID, attrs['name'], 'money'], 10000);
        } else {
            queueDelete(CHARACTERS, evt);
            return input;
        }
    }, (err) => {
        bot.sendMessage({
            to: userID,
            message: `Invalid Format: ${JSON.stringify(err)}`
        });
        queueDelete(CHARACTERS, evt);
        return input;
    });
}

function onMessage(user, userID, channelID, message, evt) {
    // logger.info(`channelID: ${channelID}`);
    if (message.startsWith(',')) {
        state = handleCommand(state, arguments);
    } else {
        if (channelID === CHARACTERS) {
            state = addCharacter(state, arguments);
        }
    }
}

// Configure logger settings
logger.remove(logger.transports.Console);
logger.add(new logger.transports.Console, {
    colorize: true
});
logger.level = 'debug';

var bot = new Discord.Client({
    "autorun": true,
    "token": auth.token
});

bot.on('ready', function(evt) {
    logger.info('Connected');
    logger.info('Logged in as: ');
    logger.info(bot.username + ' - (' + bot.id + ')');
});


bot.on('message', onMessage);

process.on('exit', (code) => saveStateSync());
process.on('SIGINT', () => process.exit(0));

// vim: foldmethod=indent
