const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
require('dotenv').config();

const User = mongoose.model('User');

// Configure nodemailer transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USERNAME,
        pass: process.env.EMAIL_PASSWORD,
    },
});

// Helper function to generate a verification code
const generateVerificationCode = () => Math.floor(100000 + Math.random() * 900000);

// Signup endpoint
router.post('/signup', async (req, res) => {
    const { name, email, password } = req.body;

    // Validate request fields
    if (!name || !email || !password) {
        return res.status(400).json({ error: 'Please provide all required fields' });
    }

    try {
        // Check for existing user
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(409).json({ error: 'Email is already registered' });
        }


        // Generate verification code
        const verificationCode = generateVerificationCode();

        // Create and save the new user
        const newUser = new User({
            name,
            email,
            password,
            verificationCode,
        });

        await newUser.save();
        const token = jwt.sign({ _id: newUser._id, email: newUser.email }, process.env.JWT_SECRET);


        // Send verification email
        const mailOptions = {
            from: process.env.EMAIL_USERNAME,
            to: email,
            subject: 'Email Verification',
            text: `Your verification code is: ${verificationCode}`,
        };

        transporter.sendMail(mailOptions, (error) => {
            if (error) {
                console.error('Error sending email:', error);
                return res.status(500).json({ error: 'Failed to send verification email' });
            }

            res.status(201).json({
                message: 'User registered successfully. Please check your email for the verification code.', token
            });
        });
    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Sign-in endpoint
router.post('/signin', async (req, res) => {
    const { email, password } = req.body;

    // Validate request fields
    if (!email || !password) {
        return res.status(400).json({ error: 'Please provide both email and password' });
    }

    try {
        // Check if the user exists by email
        const savedUser = await User.findOne({ email });

        if (!savedUser) {
            // Return error if user is not found
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Compare provided password with stored hashed password
        const isPasswordMatch = await bcrypt.compare(password, savedUser.password);

        // Debugging statements (you may remove these once you confirm everything works as expected)
        console.log('Provided password:', password);
        console.log('Stored hashed password:', savedUser.password);
        console.log('Password match result:', isPasswordMatch);

        if (!isPasswordMatch) {
            // Return error if passwords do not match
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Generate a JWT token with the user's ID as payload
        const token = jwt.sign({ _id: savedUser._id }, process.env.JWT_SECRET, {
            expiresIn: '1h', // Token expiration time (1 hour)
        });

        // Respond with the JWT token and success message
        res.json({
            message: 'Signin successful',
            token,
        });
    } catch (error) {
        // Handle unexpected errors gracefully
        console.error('Error during sign-in:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/request-password-reset', async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ error: 'Please provide an email' });
    }

    try {
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Generate password reset token and expiration time
        const resetToken = generateVerificationCode();
        user.resetToken = resetToken;
        user.resetTokenExpiration = Date.now() + 3600000; // 1 hour expiration

        await user.save();

        // Send password reset email
        const mailOptions = {
            from: process.env.EMAIL_USERNAME,
            to: email,
            subject: 'Password Reset Request',
            text: `Your password reset verification code is: ${resetToken}`,
        };

        transporter.sendMail(mailOptions, (error) => {
            if (error) {
                console.error('Error sending email:', error);
                return res.status(500).json({ error: 'Failed to send password reset email' });
            }

            // Include resetToken in the response
            res.json({ message: 'Password reset email sent with verification code.', resetToken });
        });
    } catch (error) {
        console.error('Request password reset error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.post('/confirm-password-reset', async (req, res) => {
    const { email, resetToken, verificationCode, newPassword } = req.body;
    console.log('Request body:', req.body);

    // Check if the reset token matches the verification code
    if (resetToken.toString() !== verificationCode) {
        return res.status(400).json({ error: 'Verification code does not match. Please enter the correct verification code.' });
    }

    try {
        // Find the user by email
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Update the user's password
        user.password = newPassword;

        // Clear the reset token and expiration
        user.resetToken = undefined;
        user.resetTokenExpiration = undefined;

        // Save the updated user
        await user.save();

        // Respond with success message
        return res.status(200).json({ message: 'Password reset successful' });
    } catch (error) {
        console.error('Error confirming password reset:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
router.post('/userdata', async (req, res) => {
    const { token } = req.body;

    try {
        console.log('Incoming token:', token);

        // Verify JWT token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log('Decoded token:', decoded);

        const userId = decoded._id;
        const user = await User.findById(userId);

        if (!user) {
            console.log('User not found');
            return res.status(404).json({ error: 'User not found' });
        }

        console.log('User data:', user);

        // Respond with user data
        res.json({
            _id: user._id,
            name: user.name,
            email: user.email,
            image: user.image,
        });
    } catch (error) {
        console.error('Fetching user data error:', error);
        res.status(401).json({ error: 'Invalid token' });
    }
});

// Updating user data endpoint
// Updating user data endpoint
router.post('/updateuser', async (req, res) => {
    const { token, name, image } = req.body;

    try {
        console.log('Incoming token:', token); // Logging incoming token

        // Verify JWT token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log('Decoded token:', decoded); // Logging decoded token

        const userId = decoded._id;

        // Find the user by ID
        console.log('Searching for user with ID:', userId); // Logging user search
        const user = await User.findById(userId);

        if (!user) {
            console.log('User not found'); // Logging user not found
            return res.status(404).json({ error: 'User not found' });
        }

        // Update user data
        if (name) {
            console.log('Updating name to:', name); // Logging name update
            user.name = name;
        }
        if (image) {
            console.log('Updating image to:', image); // Logging image update
            user.image = image;
        }

        // Save the updated user data
        await user.save();

        console.log('User data updated successfully'); // Logging successful update
        res.json({ message: 'User data updated successfully' });
    } catch (error) {
        console.error('Updating user data error:', error); // Logging error
        res.status(401).json({ error: 'Invalid token' });
    }
});
router.post('/facebookSignIn', async (req, res) => {
    const { name, image } = req.body;
    console.log('Request body:', req.body);
    try {
        // Check if the user already exists in the database based on name (you may adjust this)
        let user = await User.findOne({ name });

        if (!user) {
            // Create a new user if not found
            user = new User({
                name,
                image
            });
            await user.save();
        }

        // Generate JWT token for the user
        const token = jwt.sign({ _id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });

        // Respond with success message and token
        res.json({ message: 'Facebook Sign-in successful', token });
    } catch (error) {
        console.error('Facebook Sign-in error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.post('/googleSignIn', async (req, res) => {
    const { name, email, image } = req.body;
    console.log('Request body:', req.body);

    try {
        // Check if the user already exists in the database
        let user = await User.findOne({ email });

        if (!user) {
            // Create a new user if not found
            user = new User({
                name,
                email,
                image
            });

            await user.save();
        }

        // Generate and send back a JWT token
        const token = jwt.sign({ _id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.json({ message: 'Google Sign-in successful', token });
    } catch (error) {
        console.error('Google sign-in error:', error);
        res.status(500).send('Internal Server Error');
    }
});
router.post('/adminsignup', async (req, res) => {
    const { adminname, email, adminpassword } = req.body;
    console.log('Request body:', req.body);


    // Validate request fields
    if (!adminname || !email || !adminpassword) {
        return res.status(400).json({ error: 'Please provide all required fields' });
    }

    try {
        // Check for existing user
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(409).json({ error: 'Email is already registered' });
        }


        // Generate verification code
        const verificationCode = generateVerificationCode();

        // Create and save the new user
        const newUser = new User({
            adminname,
            email,
            adminpassword,
            verificationCode
        });

        await newUser.save();
        const token = jwt.sign({ _id: newUser._id, email: newUser.email }, process.env.JWT_SECRET);


        // Send verification email
        const mailOptions = {
            from: process.env.EMAIL_USERNAME,
            to: email,
            subject: 'Email Verification',
            text: `Your verification code is: ${verificationCode}`,
        };

        transporter.sendMail(mailOptions, (error) => {
            if (error) {
                console.error('Error sending email:', error);
                return res.status(500).json({ error: 'Failed to send verification email' });
            }

            res.status(201).json({
                message: 'User registered successfully. Please check your email for the verification code.', token
            });
        });
    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.post('/adminsignin', async (req, res) => {
    const { adminname, adminpassword } = req.body;

    // Validate request fields
    if (!adminname || !adminpassword) {
        return res.status(400).json({ error: 'Please provide both email and password' });
    }

    try {
        // Check if the user exists by email
        const savedUser = await User.findOne({ adminname });

        if (!savedUser) {
            // Return error if user is not found
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Compare provided password with stored hashed password
        const isPasswordMatch = await bcrypt.compare(adminpassword, savedUser.adminpassword);

        // Debugging statements (you may remove these once you confirm everything works as expected)
        console.log('Provided password:', adminpassword);
        console.log('Stored hashed password:', savedUser.adminpassword);
        console.log('Password match result:', isPasswordMatch);

        if (!isPasswordMatch) {
            // Return error if passwords do not match
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Generate a JWT token with the user's ID as payload
        const token = jwt.sign({ _id: savedUser._id }, process.env.JWT_SECRET, {
            expiresIn: '1h', // Token expiration time (1 hour)
        });

        // Respond with the JWT token and success message
        res.json({
            message: 'Signin successful',
            token,
        });
    } catch (error) {
        // Handle unexpected errors gracefully
        console.error('Error during sign-in:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
module.exports = router;
