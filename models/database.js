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
            .andWhere('payment.status', 'Paid Off')
            .first();
    }

    getMonthlyRevenue() {
        return this.db('payment')
            .select(this.db.raw("DATE_FORMAT(created_at, '%Y-%m') as month"))
            .sum('event_price as total')
            .where('events_id', 13)
            .andWhere('payment.status', 'Paid Off')
            .groupBy('month')
            .orderBy('month', 'asc');
    }

    // === Pitboss State & Log methods ===
    async getAllPitbossStates() {
        return this.db('pitboss_state').select('*');
    }

    async getPitbossState(mapCode, bossName) {
        return this.db('pitboss_state')
            .select('last_status', 'last_checked')
            .where({ map_code: mapCode, boss_name: bossName })
            .first();
    }

    async insertPitbossState(mapCode, bossName, status, timestamp) {
        return this.db('pitboss_state').insert({
            map_code: mapCode,
            boss_name: bossName,
            last_status: status,
            last_checked: timestamp
        });
    }

    async updatePitbossState(mapCode, bossName, newStatus, timestamp) {
        return this.db('pitboss_state')
            .where({ map_code: mapCode, boss_name: bossName })
            .update({
                last_status: newStatus,
                last_checked: timestamp
            });
    }

    async insertPitbossLog(mapCode, bossName, oldStatus, newStatus, timestamp) {
        return this.db('pitboss_log').insert({
            map_code: mapCode,
            boss_name: bossName,
            old_status: oldStatus,
            new_status: newStatus,
            changed_at: timestamp
        });
    }
}

module.exports = new Database();
