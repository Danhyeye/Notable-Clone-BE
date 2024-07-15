const express = require('express');
const { body, validationResult } = require('express-validator');
const authMiddleware = require('../authMiddleware');
const router = express.Router();
const pool = require('../db');
const NoteService = require('../services/NoteService');

// Get all notes (possibly for admin use, should be protected)
router.get('/', authMiddleware, async (req, res) => {
    try {
        const [notes] = await pool.query('SELECT * FROM notes');
        res.json(notes);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get all notes by user ID
router.get('/user/:id', authMiddleware, async (req, res) => {
    const { id } = req.params;
    try {
        const [notes] = await pool.query('SELECT * FROM notes WHERE user_id = ?', [id]);
        res.json(notes);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get favorite notes by user ID
router.get('/user/:id/favorites', authMiddleware, async (req, res) => {
    const { id } = req.params;
    try {
        const [notes] = await pool.query('SELECT * FROM notes WHERE user_id = ? AND favorite = 1', [id]);
        res.json(notes);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get tagged notes by user ID
router.get('/user/:id/tags', authMiddleware, async (req, res) => {
    const { id } = req.params;
    try {
        const [notes] = await pool.query('SELECT * FROM notes WHERE user_id = ? AND JSON_LENGTH(tags) > 0', [id]);
        res.json(notes);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get untagged notes by user ID
router.get('/user/:id/untagged', authMiddleware, async (req, res) => {
    const { id } = req.params;
    try {
        const [notes] = await pool.query('SELECT * FROM notes WHERE user_id = ? AND JSON_LENGTH(tags) = 0', [id]);
        res.json(notes);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get trashed notes by user ID
router.get('/user/:id/trash', authMiddleware, async (req, res) => {
    const { id } = req.params;
    try {
        const [notes] = await pool.query('SELECT * FROM notes WHERE user_id = ? AND inTrash = 1', [id]);
        res.json(notes);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get all tags by user ID
router.get('/user/:id/all-tags', authMiddleware, async (req, res) => {
    const { id } = req.params;
    try {
        const [tags] = await pool.query('SELECT DISTINCT JSON_UNQUOTE(JSON_EXTRACT(tags, "$[*]")) AS tag FROM notes WHERE user_id = ?', [id]);
        res.json(tags.map(row => row.tag));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create a note
router.post('/create-note', authMiddleware,
    body('userId').isInt(),
    body('title').isString(),
    body('content').isString(),
    body('tags').isArray().optional(),
    body('attachments').isArray().optional(),
    body('favorite').isBoolean().optional(),
    body('pinned').isBoolean().optional(),
    body('inTrash').isBoolean().optional(),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { userId, title, content, tags = [], attachments = [], favorite = false, pinned = false, inTrash = false } = req.body;

        try {
            const [result] = await pool.query(
                `INSERT INTO notes (user_id, title, content, tags, attachments, favorite, pinned, inTrash, createdAt, modifiedAt)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
                [userId, title, content, JSON.stringify(tags), JSON.stringify(attachments), favorite, pinned, inTrash]
            );
            const newNote = {
                id: result.insertId,
                userId,
                title,
                content,
                tags,
                attachments,
                favorite,
                pinned,
                inTrash,
                createdAt: new Date(),
                modifiedAt: new Date()
            };
            res.status(201).send(newNote);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    }
);

// Update a note
router.put('/update-note/:id', authMiddleware,
    body('title').isString(),
    body('content').isString(),
    async (req, res) => {
        const { id } = req.params;
        const { title, content } = req.body;
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        try {
            await NoteService.updateNoteField(id, 'title', title);
            await NoteService.updateNoteField(id, 'content', content);

            const [updatedNote] = await pool.query('SELECT * FROM notes WHERE id = ?', [id]);

            res.json(updatedNote[0]);
        } catch (error) {
            res.status(500).json({ message: 'Server error', error });
        }
    }
);

// Create a tag
router.post('/create-tag', authMiddleware,
    body('noteId').isInt(),
    body('tag').isString(),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { noteId, tag } = req.body;

        try {
            const [rows] = await pool.query('SELECT tags FROM notes WHERE id = ?', [noteId]);
            const existingTags = JSON.parse(rows[0].tags || '[]');
            existingTags.push(tag);

            await pool.query(
                `UPDATE notes SET tags = ? WHERE id = ?`,
                [JSON.stringify(existingTags), noteId]
            );
            res.status(201).send({ message: 'Tag added successfully' });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    }
);

// Delete a tag
router.delete('/delete-tag', authMiddleware,
    body('noteId').isInt(),
    body('tag').isString(),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { noteId, tag } = req.body;

        try {
            const [rows] = await pool.query('SELECT tags FROM notes WHERE id = ?', [noteId]);
            const existingTags = JSON.parse(rows[0].tags || '[]');
            const updatedTags = existingTags.filter(t => t !== tag);

            await pool.query(
                `UPDATE notes SET tags = ? WHERE id = ?`,
                [JSON.stringify(updatedTags), noteId]
            );
            res.status(200).send({ message: 'Tag deleted successfully' });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    }
);

// Create an attachment
router.post('/create-attachment', authMiddleware,
    body('noteId').isInt(),
    body('attachment').isString(),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { noteId, attachment } = req.body;

        try {
            const [rows] = await pool.query('SELECT attachments FROM notes WHERE id = ?', [noteId]);
            const existingAttachments = JSON.parse(rows[0].attachments || '[]');
            existingAttachments.push(attachment);

            await pool.query(
                `UPDATE notes SET attachments = ? WHERE id = ?`,
                [JSON.stringify(existingAttachments), noteId]
            );
            res.status(201).send({ message: 'Attachment added successfully' });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    }
);

// Delete an attachment
router.delete('/delete-attachment', authMiddleware,
    body('noteId').isInt(),
    body('attachment').isString(),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { noteId, attachment } = req.body;

        try {
            const [rows] = await pool.query('SELECT attachments FROM notes WHERE id = ?', [noteId]);
            const existingAttachments = JSON.parse(rows[0].attachments || '[]');
            const updatedAttachments = existingAttachments.filter(a => a !== attachment);

            await pool.query(
                `UPDATE notes SET attachments = ? WHERE id = ?`,
                [JSON.stringify(updatedAttachments), noteId]
            );
            res.status(200).send({ message: 'Attachment deleted successfully' });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    }
);

// Update note status (favorite, pinned, inTrash)
router.put('/update-status/:id', authMiddleware,
    body('favorite').isBoolean().optional(),
    body('pinned').isBoolean().optional(),
    body('inTrash').isBoolean().optional(),
    async (req, res) => {
        const { id } = req.params;
        const { favorite, pinned, inTrash } = req.body;

        try {
            if (favorite !== undefined) {
                await NoteService.updateNoteField(id, 'favorite', favorite);
            }
            if (pinned !== undefined) {
                await NoteService.updateNoteField(id, 'pinned', pinned);
            }
            if (inTrash !== undefined) {
                await NoteService.updateNoteField(id, 'inTrash', inTrash);
            }

            const [updatedNote] = await pool.query('SELECT * FROM notes WHERE id = ?', [id]);

            res.json(updatedNote[0]);
        } catch (error) {
            res.status(500).json({ message: 'Server error', error });
        }
    }
);

// Permanently delete a note
router.delete('/delete-note/:id', authMiddleware, async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM notes WHERE id = ?', [id]);
        res.json({ message: 'Note deleted permanently' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
