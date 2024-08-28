const APP_NAME = "Slice-URL";

export const accountConfirmationTemplate = (fullName, confirmationUrl) => {
  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.6;">
      <h2>${APP_NAME} Account Confirmation</h2>
      <p>Hi ${fullName},</p>
      <p>Thank you for registering with us! Please confirm your email address by clicking the link below:</p>
      <a href="${confirmationUrl}" style="display: inline-block; padding: 10px 20px; background-color: #28a745; color: white; text-decoration: none; border-radius: 5px;">
        Confirm your account
      </a>
      <p>If the button above does not work, you can also confirm your account by clicking the link below:</p>
      <p><a href="${confirmationUrl}">${confirmationUrl}</a></p>
      <p>Thanks,<br/>Fazle Rabbi</p>
    </div>
  `;
};

export const users = [
    {
      email: "rabbi@gmail.com",
      username: "fazlerabbidev",
      fullName: "Fazle Rabbi",
      createdAt: new Date(),
      isAccountConfirmed: true,
      authType: "email+password"
    }
  ];
