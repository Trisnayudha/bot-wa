const knex = require('knex');
const config = require('../config/databaseConfig');

class Database {
    constructor() {
        this.db = knex(config);
    }

    getEventDelegate() {
        return this.db('payment')
            .join('users', 'users.id', 'payment.users_id')
            .select('users.name', 'users.company_name', 'payment.event_price')
            .where('payment.events_id', 13)
            .andWhere('payment.status', 'Paid Off');
    }

    getTotalRevenue() {
        return this.db('payment')
            .sum('event_price as total')
            .where('events_id', 13)
            .andWhere('payment.status','Paid Off')
            .first();
    }

    getMonthlyRevenue() {
        return this.db('payment')
            .select(this.db.raw("DATE_FORMAT(created_at, '%Y-%m') as month"))
            .sum('event_price as total')
            .where('events_id',13)
            .andWhere('payment.status','Paid Off')
            .groupBy('month')
            .orderBy('month', 'asc');
    }
}

module.exports = new Database();
