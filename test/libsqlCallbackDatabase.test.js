const test = require('node:test');
const assert = require('node:assert/strict');
const { LibsqlCallbackDatabase } = require('../models/LibsqlCallbackDatabase');

function callbackResult(register) {
    return new Promise((resolve, reject) => {
        register((error, value) => error ? reject(error) : resolve(value));
    });
}

function tursoRow(values, columns) {
    const row = [...values];
    columns.forEach((column, index) => {
        Object.defineProperty(row, column, {
            value: values[index],
            enumerable: false
        });
    });
    return row;
}

test('LibsqlCallbackDatabase preserves sqlite-style callbacks and query order', async () => {
    const calls = [];
    const client = {
        async execute(statement) {
            calls.push(statement);
            if (statement.sql.startsWith('INSERT')) {
                return { rows: [], rowsAffected: 1, lastInsertRowid: 42n };
            }
            if (statement.sql.startsWith('SELECT one')) {
                return { rows: [tursoRow([42n, 'Aviator'], ['id', 'label'])], rowsAffected: 0 };
            }
            return {
                rows: [tursoRow([2n], ['count']), tursoRow([3n], ['count'])],
                rowsAffected: 0
            };
        },
        close() {}
    };
    const database = new LibsqlCallbackDatabase(client);

    const insert = await new Promise((resolve, reject) => {
        database.run('INSERT INTO frames(name) VALUES (?)', ['Aviator'], function(error) {
            if (error) return reject(error);
            resolve({ lastID: this.lastID, changes: this.changes });
        });
    });
    const row = await callbackResult(done => database.get('SELECT one', [], done));
    const rows = await callbackResult(done => database.all('SELECT many', done));

    assert.deepEqual(insert, { lastID: 42, changes: 1 });
    assert.deepEqual(row, { id: 42, label: 'Aviator' });
    assert.deepEqual(rows, [{ count: 2 }, { count: 3 }]);
    assert.deepEqual(calls.map(call => call.sql), [
        'INSERT INTO frames(name) VALUES (?)',
        'SELECT one',
        'SELECT many'
    ]);
});

test('prepared statement finalize reports an earlier queued query failure', async () => {
    let queryCount = 0;
    const client = {
        async execute() {
            queryCount += 1;
            if (queryCount === 2) throw new Error('second insert failed');
            return { rows: [], rowsAffected: 1, lastInsertRowid: BigInt(queryCount) };
        },
        close() {}
    };
    const database = new LibsqlCallbackDatabase(client);
    const statement = database.prepare('INSERT INTO frames(name) VALUES (?)');

    statement.run('first');
    statement.run('second');
    const error = await new Promise(resolve => statement.finalize(resolve));

    assert.equal(error.message, 'second insert failed');
    assert.equal(queryCount, 2);
});

test('close waits for queued work before closing the Turso client', async () => {
    const events = [];
    const client = {
        async execute() {
            events.push('query');
            return { rows: [], rowsAffected: 0 };
        },
        close() {
            events.push('close');
        }
    };
    const database = new LibsqlCallbackDatabase(client);
    database.run('PRAGMA table_info(frames)');
    await new Promise((resolve, reject) => database.close(error => error ? reject(error) : resolve()));

    assert.deepEqual(events, ['query', 'close']);
    assert.equal(database.closed, true);
});
