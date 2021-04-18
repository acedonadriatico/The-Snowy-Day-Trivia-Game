const Alexa = require('ask-sdk-core');
const util = require('./util.js');
const replace_entity_directive_template = require('./replace-entity-directive-template.json');
const clear_entities_directive = require('./clear-entities-directive.json');
const i18n = require('i18next');
const language_strings = require('./language-strings.json');
const apl_picture_template = require('./apl/picture-template.json');
const apl_motion_picture_template = require('./apl/motion-picture-template.json');

const LaunchRequestHandler = {
    canHandle(handler_input) {
        return Alexa.getRequestType(handler_input.requestEnvelope) === 'LaunchRequest';
    },
    async handle(handler_input) {
        const names = handler_input.t("opponent_names", { "returnObjects": true });
        const opponent_name = names[Math.floor(Math.random() * names.length)];
        const questions = handler_input.t("questions", { "returnObjects": true });
        const question = questions[0];
        const { point_value, intro, prompt, answers } = question;
        
        let speak_output = handler_input.t("welcome_msg", { "opponent_name": opponent_name });
        speak_output += " " + handler_input.t("question_msg", {
            "point_value": point_value,
            "intro": intro,
            "prompt": prompt,
            "answer_0": answers[0],
            "answer_1": answers[1],
            "answer_2": answers[2]
        });
        const reprompt_output = handler_input.t("welcome_msg_reprompt", {
            "prompt": prompt,
            "answer_0": answers[0],
            "answer_1": answers[1],
            "answer_2": answers[2]
        });
        let replace_entity_directive = replace_entity_directive_template;
        
        for (let i = 0; i < answers.length; i++) {
            replace_entity_directive.types[0].values[i].name.value = answers[i];
        }
        await handler_input.attributesManager.setSessionAttributes({
            "player_points": 0,
            "opponent_points": 0,
            "opponent_name": opponent_name,
            "question_index": 0
        });
        if (util.supportsAPL(handler_input)) {
            let apl_picture = apl_picture_template;
            apl_picture.datasources.data.url = util.getS3PreSignedUrl(`Media/q_1.png`);
            
            return handler_input.responseBuilder
                .speak(speak_output)
                .reprompt(reprompt_output)
                .addDirective({
                    "type": "Alexa.Presentation.APL.RenderDocument",
                    "document": apl_picture.document,
                    "datasources": apl_picture.datasources
                })
                .addDirective(replace_entity_directive)
                .getResponse();
        } else {
            return handler_input.responseBuilder
                .speak(speak_output)
                .reprompt(reprompt_output)
                .addDirective(replace_entity_directive)
                .getResponse();
        }
    }
};
const SelectQuizAnswerIntentHandler = {
    canHandle(handler_input) {
        return Alexa.getRequestType(handler_input.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handler_input.requestEnvelope) === 'SelectQuizAnswerIntent';
    },
    async handle(handler_input) {
        const session_attributes = await handler_input.attributesManager.getSessionAttributes();
        const player_quiz_answer = handler_input.requestEnvelope.request.intent.slots["player_quiz_answer"].resolutions.resolutionsPerAuthority[1].values[0].value.name;
        
        let reprompt_output, random_number, is_player_correct;
        let entity_directive = clear_entities_directive;
        const OPPONENT_PROBABILITY = 60;
        
        let { player_points, opponent_points, opponent_name, question_index } = session_attributes;
        const questions = handler_input.t("questions", { "returnObjects": true });
        let question = questions[question_index];
        const { correct_answer_index } = question;
        const correct_answer = question["answers"][correct_answer_index];
        
        let speak_output = handler_input.t("selection_msg", { "player_quiz_answer": player_quiz_answer });
        
        if (player_quiz_answer === correct_answer) {
            is_player_correct = true;
            player_points += question["point_value"];
            
            const positive_responses = [
                `<audio src="soundbank://soundlibrary/ui/gameshow/amzn_ui_sfx_gameshow_positive_response_01"/>`,
                `<audio src="soundbank://soundlibrary/ui/gameshow/amzn_ui_sfx_gameshow_positive_response_02"/>`
            ];
            speak_output += " " + positive_responses[Math.floor(Math.random() * positive_responses.length)];
            speak_output += ` ${question["correct_answer_msg"]} <break time="1s"/>`;
            
            // simulate opponent
            random_number = Math.floor(Math.random() * 101);
            if (random_number <= OPPONENT_PROBABILITY) {
                opponent_points += question["point_value"];
                speak_output += handler_input.t("opponent_correct_too_msg", { "opponent_name": opponent_name });
            } else {
                const opponent_incorrect_msgs = handler_input.t("opponent_incorrect_msgs", { "returnObjects": true });
                const length = opponent_incorrect_msgs.length;
                const opponent_incorrect_msg = opponent_incorrect_msgs[Math.floor(Math.random() * length)];
                
                speak_output += " " + opponent_name + " " + opponent_incorrect_msg + `<break time="1s"/>`;
            }
        } else { // player's answer is wrong
            is_player_correct = false;
            const negative_responses = [
                `<audio src="soundbank://soundlibrary/ui/gameshow/amzn_ui_sfx_gameshow_negative_response_01"/>`,
                `<audio src="soundbank://soundlibrary/ui/gameshow/amzn_ui_sfx_gameshow_negative_response_02"/>`,
                `<audio src="soundbank://soundlibrary/ui/gameshow/amzn_ui_sfx_gameshow_negative_response_03"/>`
            ];
            speak_output += " " + negative_responses[Math.floor(Math.random() * negative_responses.length)];
            speak_output += ` ${question["wrong_answer_msg"]} <break time="1s"/>`;
            
            // simulate opponent
            random_number = Math.floor(Math.random() * 101);
            if (random_number <= OPPONENT_PROBABILITY) {
                const opponent_correct_msgs = handler_input.t("opponent_correct_msgs", { "returnObjects": true });
                const length = opponent_correct_msgs.length;
                const opponent_correct_msg = opponent_correct_msgs[Math.floor(Math.random() * length)];
                
                speak_output += " " + opponent_name + " " + opponent_correct_msg;
                opponent_points += question["point_value"];
            } else {
                speak_output += " " + handler_input.t("opponent_incorrect_too_msg", { "opponent_name": opponent_name });
            }
        }
        question_index++;
        
        if (question_index < questions.length) {
            // set-up next question
            question = questions[question_index];
            const { point_value, intro, prompt, answers } = question;
            entity_directive = replace_entity_directive_template;
            
            for (let i = 0; i < answers.length; i++) {
                entity_directive.types[0].values[i].name.value = answers[i];
            }
            speak_output += " " + handler_input.t("question_msg", {
                "point_value": point_value,
                "intro": intro,
                "prompt": prompt,
                "answer_0": answers[0],
                "answer_1": answers[1],
                "answer_2": answers[2]
            });
            const reprompt_output = handler_input.t("welcome_msg_reprompt", {
                "prompt": prompt,
                "answer_0": answers[0],
                "answer_1": answers[1],
                "answer_2": answers[2]
            });
            await handler_input.attributesManager.setSessionAttributes({
               "player_points": player_points,
               "opponent_points": opponent_points,
               "opponent_name": opponent_name,
               "question_index": question_index
            });
            if (util.supportsAPL(handler_input)) {
                let apl_motion_picture = apl_motion_picture_template;
                apl_motion_picture.datasources.data.url = util.getS3PreSignedUrl(`Media/q_${question_index+1}.png`);
                
                if (is_player_correct) {
                    apl_motion_picture.datasources.data.choreo = "MixedExpressiveShakes";
                } else {
                    apl_motion_picture.datasources.data.choreo = "ScreenImpactCenter";
                }
                return handler_input.responseBuilder
                    .speak(speak_output)
                    .reprompt(reprompt_output)
                    .addDirective({
                        "type": "Alexa.Presentation.APL.RenderDocument",
                        "document": apl_motion_picture.document,
                        "datasources": apl_motion_picture.datasources
                    })
                    .addDirective(entity_directive)
                    .getResponse();
            } else {
                return handler_input.responseBuilder
                    .speak(speak_output)
                    .reprompt(reprompt_output)
                    .addDirective(entity_directive)
                    .getResponse();
            }
        } else { // end of game
            speak_output += " " + handler_input.t("end_game_msg");
            
            if (player_points > opponent_points) {
                speak_output += " " + handler_input.t("positive_score_msg", {
                    "opponent_name": opponent_name,
                    "opponent_points": opponent_points,
                    "player_points": player_points
                });
            } else if (player_points < opponent_points) {
                speak_output += " " + handler_input.t("negative_score_msg", {
                    "opponent_name": opponent_name,
                    "opponent_points": opponent_points,
                    "player_points": player_points
                });
            } else { // tie
                speak_output += " " + handler_input.t("neutral_score_msg", {
                    "opponent_name": opponent_name,
                    "opponent_points": opponent_points,
                    "player_points": player_points
                });
            }
            speak_output += " " + handler_input.t("goodbye_msg");
            
            return handler_input.responseBuilder
                .speak(speak_output)
                .withShouldEndSession(true)
                .getResponse();
        }
    }
};
const RepeatIntentHandler = {
    canHandle(handler_input) {
        return Alexa.getRequestType(handler_input.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handler_input.requestEnvelope) === 'AMAZON.RepeatIntent';
    },
    async handle(handler_input) {
        const session_attributes = await handler_input.attributesManager.getSessionAttributes();
        
        if (session_attributes.previous_reprompt_output) {
            return handler_input.responseBuilder
                .speak(session_attributes.previous_reprompt_output)
                .reprompt(session_attributes.previous_reprompt_output)
                .getResponse();
        } else {
            const speak_output = handler_input.t("goodbye_msg");
            
            return handler_input.responseBuilder
                .speak(speak_output)
                .withShouldEndSession(true)
                .getResponse();
        }
    }
};
const WaitIntentHandler = {
    canHandle(handler_input) {
        return Alexa.getRequestType(handler_input.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handler_input.requestEnvelope) === 'WaitIntent';
    },
    handle(handler_input) {
        const break_time = 10; // duration in seconds Alexa waits before prompting user again
        const speak_output = handler_input.t("wait_msg", {"break_time": break_time});
        const reprompt_output = handler_input.t("wait_reprompt");
        
        return handler_input.responseBuilder
            .speak(speak_output)
            .reprompt(reprompt_output)
            .getResponse();
    }
};
const HelpIntentHandler = {
    canHandle(handler_input) {
        return Alexa.getRequestType(handler_input.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handler_input.requestEnvelope) === 'AMAZON.HelpIntent';
    },
    handle(handler_input) {
        const speak_output = handler_input.t("help_msg");

        return handler_input.responseBuilder
            .speak(speak_output)
            .reprompt(speak_output)
            .getResponse();
    }
};
const CancelAndStopIntentHandler = {
    canHandle(handler_input) {
        return Alexa.getRequestType(handler_input.requestEnvelope) === 'IntentRequest'
            && (Alexa.getIntentName(handler_input.requestEnvelope) === 'AMAZON.CancelIntent'
                || Alexa.getIntentName(handler_input.requestEnvelope) === 'AMAZON.StopIntent');
    },
    handle(handler_input) {
        const speak_output = handler_input.t("goodbye_msg");
        
        return handler_input.responseBuilder
            .speak(speak_output)
            .withShouldEndSession(true)
            .getResponse();
    }
};
const FallbackIntentHandler = {
    canHandle(handler_input) {
        return Alexa.getRequestType(handler_input.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handler_input.requestEnvelope) === 'AMAZON.FallbackIntent';
    },
    handle(handler_input) {
        return RepeatIntentHandler.handle(handler_input);
    }
};
const SessionEndedRequestHandler = {
    canHandle(handler_input) {
        return Alexa.getRequestType(handler_input.requestEnvelope) === 'SessionEndedRequest';
    },
    handle(handler_input) {
        console.log(`~~~~ Session ended: ${JSON.stringify(handler_input.requestEnvelope)}`);
        
        return handler_input.responseBuilder.getResponse();
    }
};
const IntentReflectorHandler = {
    canHandle(handler_input) {
        return Alexa.getRequestType(handler_input.requestEnvelope) === 'IntentRequest';
    },
    handle(handler_input) {
        const intent_name = Alexa.getIntentName(handler_input.requestEnvelope);
        const speakOutput = handler_input.t("intent_reflector_msg", {"intent_name": intent_name});
        
        return handler_input.responseBuilder
            .speak(speakOutput)
            .getResponse();
    }
};
const ErrorHandler = {
    canHandle() {
        return true;
    },
    handle(handler_input, error) {
        const speak_output = handler_input.t("error_msg");
        console.log(`~~~~ Error handled: ${error.stack}`);
        
        return handler_input.responseBuilder
            .speak(speak_output)
            .reprompt(speak_output)
            .getResponse();
    }
};
/**
 * Logs JSON requests to CloudWatch for debugging purposes
 * */
const LoggingRequestInterceptor = {
    process(handler_input) {
        console.log("requestEnvelope: " + JSON.stringify(handler_input.requestEnvelope));
        return;
    }
};
const LocalisationRequestInterceptor = {
    process(handler_input) {
        i18n.init({
            "lng": Alexa.getLocale(handler_input.requestEnvelope),
            "resources": language_strings
        }).then((t) => {
            handler_input.t = (...args) => t(...args);
        });
    }
};
/**
 * Saves the reprompts of Alexa's responses to session attributes
 * */
const SaveRepromptResponseInterceptor = {
    async process(handler_input) {
        const session_attributes = await handler_input.attributesManager.getSessionAttributes();
        const response = handler_input.responseBuilder.getResponse();
        
        if (response.reprompt !== undefined) {
            session_attributes.previous_reprompt_output = response.reprompt.outputSpeech.ssml.replace("<speak>", "").replace("</speak>", "");
        }
        return;
    }
};
exports.handler = Alexa.SkillBuilders.custom()
    .addRequestHandlers(
        LaunchRequestHandler,
        SelectQuizAnswerIntentHandler,
        RepeatIntentHandler,
        WaitIntentHandler,
        HelpIntentHandler,
        CancelAndStopIntentHandler,
        FallbackIntentHandler,
        SessionEndedRequestHandler,
        IntentReflectorHandler)
    .addErrorHandlers(
        ErrorHandler)
    .addRequestInterceptors(
        LoggingRequestInterceptor,
        LocalisationRequestInterceptor)
    .addResponseInterceptors(
        SaveRepromptResponseInterceptor)
    .withCustomUserAgent('sample/hello-world/v1.2')
    .lambda();