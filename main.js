'use strict';

const http = require('http');
const mysqlx = require('@mysql/xdevapi');

const port = process.env.PORT || 9999;
const statusOk = 200;
const statusNotFound = 404;
const statusBadRequest = 400;
const statusIntervalServerError = 500;
const schema = 'social';

const client = mysqlx.getClient({
    user: 'app',
    password: 'pass',
    host: '0.0.0.0',
    port: 33060
});

function sendResponse(response,{status = statusOk, headers = {}, body = null}) {
    Object.entries(headers).forEach(([key,value]) => response.setHeader(key,value));

    response.writeHead(status);
    response.end(body);   
}
function sendJSON(response,body) {
    sendResponse(response, {
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });
}

function map(columns){
    return row => row.reduce((res,value,i) => ({...res, [columns[i].getColumnLabel()]: value}),{});
}

const methods = new Map();
methods.set('/posts.get', async ({response, db}) => {
    const table = await db.getTable('posts');
    const result = await table.select(['id', 'content', 'likes', 'created'])
        .where('removed=0')
        .orderBy('id Desc')
        .execute();
    const data = result.fetchAll();
    result.getAffectedItemsCount();
    const columns = result.getColumns();
    const posts = data.map(map(columns));
    sendJSON(response, posts);
});
methods.set('/posts.getById', async ({response, searchParams, db}) => {
    if (!searchParams.has('id') || !Number(searchParams.get('id'))){
        sendResponse(response,{status: statusBadRequest});
        return;
    }

    const id = Number(searchParams.get('id'));
    const table = await db.getTable('posts');
    const result = await table.select(['id', 'content', 'likes', 'created'])
        .where('removed = FAlSE AND id = :id')
        .bind('id', id)
        .execute();
    const data = result.fetchAll();
    if (data.length === 0){
        sendResponse(response,{status: statusNotFound});
        return;
    } 
    result.getAffectedItemsCount();
    const columns = result.getColumns();
    const posts = data.map(map(columns))[0];
    sendJSON(response, posts);

});
methods.set('/posts.post', async ({response, searchParams, db}) => {
    if (!searchParams.has('content')){
        sendResponse(response,{status: statusBadRequest});
        return;
    }

    const content = searchParams.get('content');
    const table = await db.getTable('posts');
    const post = await table.insert('content').values(content).execute();
    const id = post.getAutoIncrementValue();
    const result = await table.select(['id', 'content', 'likes', 'created'])
        .where('removed = 0 AND id = :id')
        .bind('id', id)
        .execute();
    const data = result.fetchAll();
    if (data.length === 0){
        sendResponse(response,{status: statusNotFound});
        return;
    } 
    result.getAffectedItemsCount();
    const columns = result.getColumns();
    const posts = data.map(map(columns))[0];
    sendJSON(response, posts);
});
methods.set('/posts.edit', async ({response, searchParams, db}) => {
    if (!searchParams.has('id') || !Number(searchParams.get('id'))){
        sendResponse(response,{status: statusBadRequest});
        return;
    }
    if (!searchParams.has('content')){
        sendResponse(response,{status: statusBadRequest});
        return;
    }
    const foundId = Number(searchParams.get('id'));
    const updateContent = searchParams.get('content');
    const table = await db.getTable('posts');
    await table.update()
        .set('content', updateContent)
        .where('removed = :removed AND id = :id')
        .bind('id', foundId)
        .bind('removed', false)
        .execute();
    const result = await table.select(['id', 'content', 'likes', 'created'])
        .where('removed = 0 AND id = :id')
        .bind('id', foundId)
        .execute();
    const data = result.fetchAll();
    if (data.length === 0){
        sendResponse(response,{status: statusNotFound});
        return;
    } 
    result.getAffectedItemsCount();
    const columns = result.getColumns();
    const posts = data.map(map(columns))[0];
    sendJSON(response, posts);
});
methods.set('/posts.delete', async ({response, searchParams, db}) => {
    if (!searchParams.has('id') || !Number(searchParams.get('id'))){
        sendResponse(response,{status: statusBadRequest});
        return;
    }
    const foundId = Number(searchParams.get('id'));
    const table = await db.getTable('posts');
    const result = await table.select(['id', 'content', 'likes', 'created'])
        .where('removed = false AND id = :id')
        .bind('id', foundId)
        .execute();
    await table.update()
        .set('removed', 1)
        .where('removed = :removed AND id = :id')
        .bind('id', foundId)
        .bind('removed', false)
        .execute();
   
    const data = result.fetchAll();
    if (data.length === 0){
        sendResponse(response,{status: statusNotFound});
        return;
    } 
    result.getAffectedItemsCount();
    const columns = result.getColumns();
    const posts = data.map(map(columns))[0];
    sendJSON(response, posts);
    
});
methods.set('/posts.restore', async ({response, searchParams, db}) => {
    if (!searchParams.has('id') || !Number(searchParams.get('id'))){
        sendResponse(response,{status: statusBadRequest});
        return;
    }
    const foundId = Number(searchParams.get('id'));
    const table = await db.getTable('posts');
    const result = await table.select(['id', 'content', 'likes', 'created'])
        .where('removed = true AND id = :id')
        .bind('id', foundId)
        .execute();
    await table.update()
        .set('removed', 0)
        .where('removed = :removed AND id = :id')
        .bind('id', foundId)
        .bind('removed', true)
        .execute();
    const data = result.fetchAll();
    if (data.length === 0){
        sendResponse(response,{status: statusNotFound});
        return;
    } 
    result.getAffectedItemsCount();
    const columns = result.getColumns();
    const posts = data.map(map(columns))[0];
    sendJSON(response, posts);
});
methods.set('/posts.like', async ({response, searchParams, db}) => {
    if (!searchParams.has('id') || !Number(searchParams.get('id'))){
        sendResponse(response,{status: statusBadRequest});
        return;
    }

    const id = Number(searchParams.get('id'));
    const table = await db.getTable('posts');
    const post = await table.select(['id', 'content', 'likes', 'created'])
        .where('removed = FALSE AND id = :id')
        .bind('id', id)
        .execute();
    const dt = post.fetchAll();
    if (dt.length === 0){
        sendResponse(response,{status: statusNotFound});
        return;
    } 
    const ip = 2;
    let updateLikes = dt[0][ip];
    updateLikes = updateLikes+1;

    await table.update()
       .set('likes', updateLikes)
       .where('removed = FALSE AND id = :id')
       .bind('id', id)
       .execute();
       
    const result = await table.select(['id', 'content', 'likes', 'created'])
       .where('removed = FALSE AND id = :id')
       .bind('id', id)
       .execute();
    const data = result.fetchAll();
    result.getAffectedItemsCount();
    const columns = result.getColumns();
    const posts = data.map(map(columns))[0];
    sendJSON(response, posts);

});
methods.set('/posts.dislike', async ({response, searchParams, db}) => {
    if (!searchParams.has('id') || !Number(searchParams.get('id'))){
        sendResponse(response,{status: statusBadRequest});
        return;
    }

    const id = Number(searchParams.get('id'));
    const table = await db.getTable('posts');
    const post = await table.select(['id', 'content', 'likes', 'created'])
        .where('removed = FALSE AND id = :id')
        .bind('id', id)
        .execute();
    const dt = post.fetchAll();
    if (dt.length === 0){
        sendResponse(response,{status: statusNotFound});
        return;
    } 
    const ip = 2;
    let updateLikes = dt[0][ip];
    updateLikes = updateLikes-1;

    await table.update()
       .set('likes', updateLikes)
       .where('removed = FALSE AND id = :id')
       .bind('id', id)
       .execute();
       
    const result = await table.select(['id', 'content', 'likes', 'created'])
       .where('removed = FALSE AND id = :id')
       .bind('id', id)
       .execute();
    const data = result.fetchAll();
    result.getAffectedItemsCount();
    const columns = result.getColumns();
    const posts = data.map(map(columns))[0];
    sendJSON(response, posts);

});

const server = http.createServer(async (request, response) => {
    const {pathname, searchParams} = new URL(request.url, `http://${request.headers.host}`);

    const method = methods.get(pathname);
    if (method === undefined){
        sendResponse(response,{status: statusNotFound});
        return;
    }
    
    let session = null;
    try {
        session = await client.getSession();
        const db = await session.getSchema(schema);

        const params = {
            request,
            response,
            pathname,
            searchParams,
            db,
        };
    
        await method(params);
    } catch (e){
        sendResponse(response, {status: statusIntervalServerError});
    } finally {
        if (session !== null) {
            try {
                await session.close();
            } catch (e) {
                console.log(e);
            }
        }
    }
});

server.listen(port);
