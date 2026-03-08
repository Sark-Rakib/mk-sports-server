const nodemailer = require("nodemailer");
require("dotenv").config();

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER, // from .env
    pass: process.env.EMAIL_PASSWORD, // from .env (App Password)
  },
});

const sendEmail = async (order) => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: process.env.EMAIL_USER, // admin email
      subject: "New Order Received - MK Sports",
      html: `
        <h2>New Order Received</h2>
        <p><b>Customer Name:</b> ${order.name}</p>
        <p><b>Email:</b> ${order.email}</p>
        <p><b>Phone:</b> ${order.phone}</p>
        <hr>
        <p><b>Product:</b> ${order.productName}</p>
        <p><b>Quantity:</b> ${order.quantity}</p>
        <p><b>Size:</b> ${order.size}</p>
        <p><b>Total Price:</b> ৳${order.totalPrice}</p>
        <hr>
        <p><b>District:</b> ${order.district}</p>
        <p><b>Street:</b> ${order.street}</p>
        <p><b>Description:</b> ${order.description}</p>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log("Email sent successfully!");
  } catch (error) {
    console.error("Error sending email:", error);
  }
};

module.exports = sendEmail;
