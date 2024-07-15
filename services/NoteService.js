const pool = require('../db');

const updateNoteField = async (id, field, value) => {
    const [result] = await pool.query(
        `UPDATE notes SET ${field} = ?, modifiedAt = NOW() WHERE id = ?`,
        [value, id]
    );
    return result;
};

module.exports = {
    updateNoteField,
};
