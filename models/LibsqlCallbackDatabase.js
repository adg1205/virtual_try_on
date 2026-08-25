function normalizeValue(value) {
    if (typeof value === 'bigint') {
        return Number.isSafeInteger(Number(value)) ? Number(value) : value.toString();
    }
    if (value instanceof Uint8Array) return Buffer.from(value);
    return value;
}

function normalizeRow(row) {
    const normalized = {};
    // Turso compatibility rows are arrays whose named column properties are
    // intentionally non-enumerable, so Object.keys() would only expose indexes.
    for (const key of Object.getOwnPropertyNames(row)) {
        if (!/^\d+$/.test(key) && key !== 'length') {
            normalized[key] = normalizeValue(row[key]);
        }
    }
    return normalized;
}

function normalizeCall(params, callback) {
    if (typeof params === 'function') {
        return { args: [], callback: params };
    }
    return {
        args: Array.isArray(params) ? params : [],
        callback: typeof callback === 'function' ? callback : null
    };
}

class LibsqlStatement {
    constructor(database, sql) {
        this.database = database;
        this.sql = sql;
        this.firstError = null;
    }

    run(...values) {
        let callback = null;
        if (typeof values[values.length - 1] === 'function') callback = values.pop();
        const args = values.length === 1 && Array.isArray(values[0]) ? values[0] : values;
        this.database.enqueue(() => this.database.client.execute({ sql: this.sql, args }))
            .then(result => {
                if (callback) {
                    callback.call({
                        lastID: normalizeValue(result.lastInsertRowid),
                        changes: Number(result.rowsAffected || 0)
                    }, null);
                }
            })
            .catch(error => {
                this.firstError ||= error;
                if (callback) callback.call({}, error);
            });
        return this;
    }

    finalize(callback) {
        this.database.wait(error => {
            if (callback) callback(this.firstError || error || null);
        });
    }
}

class LibsqlCallbackDatabase {
    constructor(client) {
        this.client = client;
        this.queue = Promise.resolve();
        this.closed = false;
    }

    enqueue(operation) {
        const result = this.queue.then(operation);
        this.queue = result.catch(() => undefined);
        return result;
    }

    serialize(callback) {
        callback();
        return this;
    }

    run(sql, params, callback) {
        const call = normalizeCall(params, callback);
        this.enqueue(() => this.client.execute({ sql, args: call.args }))
            .then(result => {
                if (call.callback) {
                    call.callback.call({
                        lastID: normalizeValue(result.lastInsertRowid),
                        changes: Number(result.rowsAffected || 0)
                    }, null);
                }
            })
            .catch(error => {
                if (call.callback) call.callback.call({}, error);
                else console.error('Unhandled Turso query error:', error);
            });
        return this;
    }

    get(sql, params, callback) {
        const call = normalizeCall(params, callback);
        this.enqueue(() => this.client.execute({ sql, args: call.args }))
            .then(result => {
                if (call.callback) {
                    const row = result.rows.length ? normalizeRow(result.rows[0]) : undefined;
                    call.callback(null, row);
                }
            })
            .catch(error => {
                if (call.callback) call.callback(error);
                else console.error('Unhandled Turso query error:', error);
            });
        return this;
    }

    all(sql, params, callback) {
        const call = normalizeCall(params, callback);
        this.enqueue(() => this.client.execute({ sql, args: call.args }))
            .then(result => {
                if (call.callback) call.callback(null, result.rows.map(normalizeRow));
            })
            .catch(error => {
                if (call.callback) call.callback(error);
                else console.error('Unhandled Turso query error:', error);
            });
        return this;
    }

    prepare(sql) {
        return new LibsqlStatement(this, sql);
    }

    wait(callback) {
        this.enqueue(async () => undefined)
            .then(() => {
                if (callback) callback(null);
            })
            .catch(error => {
                if (callback) callback(error);
            });
    }

    close(callback) {
        if (this.closed) {
            if (callback) callback(null);
            return;
        }
        this.wait(error => {
            if (!error) {
                this.closed = true;
                this.client.close();
            }
            if (callback) callback(error || null);
        });
    }
}

module.exports = {
    LibsqlCallbackDatabase,
    normalizeRow,
    normalizeValue
};
