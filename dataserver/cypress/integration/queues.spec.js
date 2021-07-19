const { golos } = global;

let { ACC, ACC2, ACC_POSTING, ACC_ACTIVE } = Cypress.env();

let { NODE_URL, CHAIN_ID } = Cypress.env();
golos.config.set('websocket', NODE_URL);
if (CHAIN_ID) {
    golos.config.set('chain_id', CHAIN_ID);
}

describe('queues - lifecycle tests', function () {
    it('/subscribe - cross-account', async function() {
        global.log('Login...')

        var login_challenge = await global.obtainLoginChallenge(ACC);

        var json = await global.signAndAuth(login_challenge, ACC, ACC_POSTING);
        expect(json.error).to.equal(undefined);
        expect(json.status).to.equal('ok');

        global.log('Test...')

        var request = {...getRequestBase(),
            method: 'get',
        };
        var resp = await fetch(global.HOST + `/subscribe/@test/send`, request);
        var json = await resp.json();

        expect(json.error).to.equal('Access denied - wrong account');
        expect(json.status).to.equal('err');
    });

    it('/subscribe - without login', async function() {
        var request = {...getRequestBase(),
            method: 'get',
        };
        var resp = await fetch(global.HOST + `/subscribe/@${ACC}/send`, request);
        var json = await resp.json();

        expect(json.error).to.equal('Access denied - not authorized');
        expect(json.status).to.equal('err');
    });

    it('/subscribe - good', async function() {
        global.log('Login...')

        var login_challenge = await global.obtainLoginChallenge(ACC);

        var json = await global.signAndAuth(login_challenge, ACC, ACC_POSTING);
        expect(json.error).to.equal(undefined);
        expect(json.status).to.equal('ok');

        global.log('Test...')

        var request = {...getRequestBase(),
            method: 'get',
        };
        var resp = await fetch(global.HOST + `/subscribe/@${ACC}/send`, request);
        var json = await resp.json();

        expect(json.error).to.equal(undefined);
        expect(typeof json.subscriber_id).to.equal('number');
        expect(json.status).to.equal('ok');

        global.log('subscriber_id' + json.subscriber_id);
    });

    it('/take - cross-account, no subscribe', async function() {
        global.log('Login...')

        var login_challenge = await global.obtainLoginChallenge(ACC);

        var json = await global.signAndAuth(login_challenge, ACC, ACC_POSTING);
        expect(json.error).to.equal(undefined);
        expect(json.status).to.equal('ok');

        global.log('Test...')

        var request = {...getRequestBase(),
            method: 'get',
        };
        var resp = await fetch(global.HOST + `/take/@test/1234`, request);
        var json = await resp.json();

        expect(json.error).to.equal('Access denied - wrong account');
        expect(json.status).to.equal('err');
    })

    it('/take - no login, no subscribe', async function() {
        var request = {...getRequestBase(),
            method: 'get',
        };
        var resp = await fetch(global.HOST + `/take/@test/1234`, request);
        var json = await resp.json();

        expect(json.error).to.equal('Access denied - not authorized');
        expect(json.status).to.equal('err');
    })

    it('/take - login, but no subscribe', async function() {
        global.log('Login...')

        var login_challenge = await global.obtainLoginChallenge(ACC);

        var json = await global.signAndAuth(login_challenge, ACC, ACC_POSTING);
        expect(json.error).to.equal(undefined);
        expect(json.status).to.equal('ok');

        global.log('Test...')

        var request = {...getRequestBase(),
            method: 'get',
        };
        var resp = await fetch(global.HOST + `/take/@${ACC}/1234`, request);
        var json = await resp.json();

        expect(json.error).to.equal('Tarantool error');
        expect(json.status).to.equal('err');
    })

    it('/take - good', async function() {
        global.log('Login...')

        var login_challenge = await global.obtainLoginChallenge(ACC);

        var json = await global.signAndAuth(login_challenge, ACC, ACC_POSTING);
        expect(json.error).to.equal(undefined);
        expect(json.status).to.equal('ok');

        global.log('Subscribe...')

        var request = {...getRequestBase(),
            method: 'get',
        };
        var resp = await fetch(global.HOST + `/subscribe/@${ACC}/send`, request);
        var json = await resp.json();

        expect(json.error).to.equal(undefined);
        expect(typeof json.subscriber_id).to.equal('number');
        expect(json.status).to.equal('ok');

        global.log('subscriber_id' + json.subscriber_id);

        global.log('Do operation...')

        await golos.broadcast.transferAsync(
            ACC_ACTIVE,
            ACC, ACC2, '0.001 GOLOS', '');

        global.log('Take...')

        var request = {...getRequestBase(),
            method: 'get',
        };
        var resp = await fetch(global.HOST + `/take/@${ACC}/${json.subscriber_id}`, request);
        var json = await resp.json();

        expect(json.error).to.equal(undefined);
        expect(json.status).to.equal('ok');
        console.log(json);
    })
})
