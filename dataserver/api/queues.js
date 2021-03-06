const koaRouter = require('koa-router');
const Tarantool = require('../tarantool');
const { returnError, SCOPES } = require('../utils');

module.exports = function useQueuesApi(app) {
    const router = new koaRouter();
    app.use(router.routes());

    let slowsCounter = 0;

    router.get('/_stats', async (ctx) => {
        try {
            const res = await Tarantool.instance('tarantool').call('notification_stats');
            ctx.body = {
                status: 'ok',
                queues: res,
                slowsCounter,
            };
        } catch (error) {
            console.error(`[reqid ${ctx.request.header['x-request-id']}] ${ctx.method} ERRORLOG notifications /stats ${error.message}`);
            ctx.body = {
                status: 'err',
                error: 'Tarantool error',
            };
        }
    });

    router.get('/subscribe/@:account/:scopes', async (ctx) => {
        const { account, scopes } = ctx.params;

        if (!ctx.session.a) {
            ctx.status = 403;
            return returnError(ctx, 'Access denied - not authorized');
        }

        if (account !== ctx.session.a) {
            ctx.status = 403;
            return returnError(ctx, 'Access denied - wrong account');
        }

        let scopesStr = scopes.split(',');

        if (!scopesStr.length) {
            return returnError(ctx, 'No correct notification scopes');
        }

        let scopeIds = {};
        for (let scope of scopesStr) {
            const i = SCOPES.indexOf(scope);
            if (i === -1) {
                return returnError(ctx, `Wrong notification scope - ${scope}`);
            }
            scopeIds[i] = true;
            if (i === 0) { // 'total'
                scopeIds = { '0': true, };
                break;
            }
        }

        let subscriber_id = 0;
        try {
            const start = new Date();

            const res = await Tarantool.instance('tarantool').call('notification_subscribe', account, scopeIds);

            const elapse = new Date() - start;
            if (elapse > 3000) {
                console.warn(`PULSE-SLOW: notifications @${account} ${elapse}`);
                ++slowsCounter;
            }
            //else
            //    console.log(`PULSE: notifications @${account} ${elapse}`);

            subscriber_id = res[0][0];
        } catch (error) {
            console.error(`[reqid ${ctx.request.header['x-request-id']}] ${ctx.method} ERRORLOG notifications @${account} ${error.message}`);
            ctx.body = {
                subscriber_id: null,
                status: 'err',
                error: 'Tarantool error',
            };
            return;
        }

        ctx.body = {
            subscriber_id,
            status: 'ok',
        };
    });

    router.get('/unsubscribe/@:account/:subscriber_id', async (ctx) => {
        const { account, subscriber_id } = ctx.params;

        if (!ctx.session.a) {
            ctx.status = 403;
            return returnError(ctx, 'Access denied - not authorized');
        }

        if (account !== ctx.session.a) {
            ctx.status = 403;
            return returnError(ctx, 'Access denied - wrong account');
        }

        let was = true;
        try {
            const res = await Tarantool.instance('tarantool').call('notification_unsubscribe', account, parseInt(subscriber_id));
            was = res[0][0].was;
        } catch (error) {
            console.error(`[reqid ${ctx.request.header['x-request-id']}] ${ctx.method} ERRORLOG notifications @${account} ${error.message}`);
            ctx.body = {
                status: 'err',
                error: 'Tarantool error',
            };
            return;
        }

        ctx.body = {
            was,
            status: 'ok',
        };
    });

    router.get('/take/@:account/:subscriber_id/:task_ids?', async (ctx) => {
        const { account, subscriber_id, task_ids } = ctx.params;

        if (!ctx.session.a) {
            ctx.status = 403;
            return returnError(ctx, 'Access denied - not authorized');
        }

        if (account !== ctx.session.a) {
            ctx.status = 403;
            return returnError(ctx, 'Access denied - wrong account');
        }

        const remove_task_ids = task_ids ? task_ids.split('-').map(x => +x) : [];

        try {
            let res = await Tarantool.instance('tarantool').call('notification_take', account, parseInt(subscriber_id), remove_task_ids);
            for (let task of res[0][0].tasks) {
                task.scope = SCOPES[task.scope];
            }
            ctx.body = {
                tasks: res[0][0].tasks,
                status: 'ok',
            };
        } catch (error) {
            console.error(`[reqid ${ctx.request.header['x-request-id']}] ${ctx.method} ERRORLOG notifications @${account} ${error.message}`);
            ctx.body = {
                tasks: null,
                status: 'err',
                error: 'Tarantool error',
            };
        }
    });
}
