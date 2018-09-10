const axios = require('axios');
const dig = require('node-dig-dns');
const dotenv = require('dotenv');

dotenv.config();

const KEY = process.env.KEY;
const SECRET = process.env.SECRET;
const DOMAIN = process.env.DOMAIN;
const SUBDOMAIN = process.env.SUBDOMAIN;
const CHALLENGE_NAME = process.env.CHALLENGE_NAME;
const CONTACT_EMAIL = process.env.CONTACT_EMAIL;
const ENV = process.env.ENV;

let CERT_DOMAIN_1;
let CERT_DOMAIN_2;
let CHALLENGE_SUBDOMAIN;
let CHALLENGE_DOMAIN;
let CERT_SERVER;

if (ENV == 'production') {
    CERT_SERVER = 'https://acme-v02.api.letsencrypt.org/directory';
} else {
    CERT_SERVER = 'https://acme-staging-v02.api.letsencrypt.org/directory';
}


if (SUBDOMAIN.length > 0) {
    CERT_DOMAIN_1 = SUBDOMAIN + '.' + DOMAIN;
    CERT_DOMAIN_2 = '*.' + SUBDOMAIN + '.' + DOMAIN;
    CHALLENGE_SUBDOMAIN = CHALLENGE_NAME + '.' + SUBDOMAIN;
    CHALLENGE_DOMAIN = CHALLENGE_SUBDOMAIN + '.' + DOMAIN;
} else {
    CERT_DOMAIN_1 = DOMAIN;
    CERT_DOMAIN_2 = '*.' + DOMAIN;
    CHALLENGE_SUBDOMAIN = CHALLENGE_NAME;
    CHALLENGE_DOMAIN = CHALLENGE_SUBDOMAIN + '.' + DOMAIN;
}

const spawn = require('child_process').spawn;
const child = spawn('certbot', ['certonly',
    '--server', CERT_SERVER,
    '--preferred-challenges', 'dns',
    '--manual',
    '-d', CERT_DOMAIN_1,
    '-d', CERT_DOMAIN_2]);

child.stdin.setEncoding('utf-8');
child.stdout.pipe(process.stdout);

child.stderr.on('data', (data) => {
    console.error(`${data}`);
});

child.stdout.on('data', (data) => {
    data = data + '';
    if (/[\s\S]*Enter email address[\s\S]*/.test(data)) {
        child.stdin.write(CONTACT_EMAIL + '\n');
    } else if (/[\s\S]*Terms of Service[\s\S]*/.test(data)) {
        child.stdin.write("A\n");
    } else if (/[\s\S]*Are you OK with your IP being logged[\s\S]*/.test(data)) {
        child.stdin.write("Y\n");
    } else if (/[\s\S]*DNS TXT[\s\S]*/.test(data)) {
        const match = /[\s\S]*following value:\n\n(.*)\n\n[\s\S]*/.exec(data);
        const record = match[1];
        createTxtRecord(record).then((response) => {
            if (response.status == 200) {
                console.log('Done creating TXT record.');
                checkRecordDeployed(record);
            } else {
                console.log('Error creating TXT record');
            }
        }).catch((error) => {
            if (/[\s\S]*Request failed with status code 422[\s\S]*/.test(error)) {
                console.warn('\nDuplicate TXT record.');
                checkRecordDeployed(record);
            } else {
                console.error(error);
            }
        });
    }
});

function createTxtRecord(record) {
    return axios.patch('https://api.godaddy.com/v1/domains/' + DOMAIN + '/records', [{
        "type": "TXT",
        "name": CHALLENGE_SUBDOMAIN,
        "ttl": 600,
        "data": record
    }],
        {
            headers: { Authorization: "sso-key " + KEY + ':' + SECRET }
        });
}

function checkRecordDeployed(record) {
    console.log('Digging for TXT records..');
    dig([CHALLENGE_DOMAIN, 'TXT'])
        .then((result) => {
            if (result && result.answer) {
                let found = false;
                result.answer.forEach(possibleRecord => {

                    console.log('.');
                    if (possibleRecord.value === '"' + record + '"') {
                        child.stdin.write("\n");
                        found = true;
                        return;
                    }
                });

                if (!found) {
                    setTimeout(() => {
                        checkRecordDeployed(record);
                    }, 5000);
                }

            } else {
                console.error('Dig error. Stoping now.');
            }
        })
        .catch((err) => {
            console.log('Error:', err);
        });
}