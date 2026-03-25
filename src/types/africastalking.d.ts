declare module 'africastalking' {
    interface Credentials {
        apiKey: string;
        username: string;
    }

    interface SMSOptions {
        to: string[];
        message: string;
        from?: string;
    }

    interface Recipient {
        statusCode: number;
        number: string;
        status: string;
        cost: string;
        messageId: string;
    }

    interface SMSResponse {
        SMSMessageData: {
            Message: string;
            Recipients: Recipient[];
        };
    }

    interface SMS {
        send(options: SMSOptions): Promise<SMSResponse>;
    }

    interface AfricasTalkingInstance {
        SMS: SMS;
    }

    function AfricasTalking(credentials: Credentials): AfricasTalkingInstance;
    export default AfricasTalking;
}
