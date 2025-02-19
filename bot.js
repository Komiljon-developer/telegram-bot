require('dotenv').config();
const { log } = require('console');
const fs = require('fs');
const TelegramBot = require('node-telegram-bot-api');

const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

const ADMIN_ID = process.env.ADMIN_ID;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const COURSES_FILE = './courses.json';
const TESTS_FILE = './tests.json';
const moment = require('moment-timezone');
let adminSessions = new Set();
let pendingActions = {};

// Test javoblari saqlanadigan obyekt
let correctAnswers = {};
// ✅ Test natijalarini avtomatik tekshirishni boshlash
// scheduleTestResults(bot);



function loadCourses() {
    if (!fs.existsSync(COURSES_FILE)) fs.writeFileSync(COURSES_FILE, JSON.stringify([]));
    return JSON.parse(fs.readFileSync(COURSES_FILE));
}

function saveCourses(courses) {
    fs.writeFileSync(COURSES_FILE, JSON.stringify(courses, null, 2));
}

function loadTests() {
    try {
        if (!fs.existsSync(TESTS_FILE)) {
            console.warn("⚠️ Test fayli mavjud emas, yangi fayl yaratildi.");
            fs.writeFileSync(TESTS_FILE, JSON.stringify(tests, null, 2), 'utf8');
            return [];
        }

        let data = fs.readFileSync(TESTS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        console.error("❌ Xatolik: testlarni yuklashda muammo yuz berdi!", err);
        return [];
    }
}

function saveTestResult(testCode, userId, userAnswers, score, username) {
    let tests = loadTests();
    let test = tests.find(t => String(t.code) === String(testCode));

    if (!test) {
        console.error("❌ Xatolik: Test topilmadi!");
        return;
    }

    if (!Array.isArray(test.results)) {
        test.results = [];
    }

    let existingResult = test.results.find(r => r.userId === userId);
    if (existingResult) {
        existingResult.score = score;
        existingResult.userAnswers = userAnswers;
        existingResult.username = username || null; // Agar username bo‘lsa, saqlaymiz
    } else {
        test.results.push({ userId, userAnswers, score, username: username || null });
    }

    fs.writeFileSync(TESTS_FILE, JSON.stringify(tests, null, 2), 'utf8');
    console.log("✅ Natija saqlandi:", { testCode, userId, userAnswers, score, username });
}



function getTestResults(testCode) {
    if (!testResults[testCode]) {
        return "❌ Bu test bo‘yicha natijalar yo‘q.";
    }

    let results = Object.entries(testResults[testCode]).map(([username, data]) => {
        return { username, ...data };
    });

    results.sort((a, b) => b.score - a.score);

    let topUser = results[0];

    let userList = results.map((res, index) => 
        `${index + 1}. ${res.username} - ${res.score} ball (${res.answers})`
    ).join("\n");

    return `📊 **Test: ${testCode} Natijalari**\n\n` + 
           `${userList}\n\n` + 
           `🏆 **G'olib:** ${topUser.username} - ${topUser.score} ball!`;
}

// function scheduleTestResults(bot) {
//     let tests = loadTests();

//     tests.forEach(test => {
//         let now = moment().tz("Asia/Tashkent").format("HH:mm");
//         let endTime = test.endTime;

//         if (now >= endTime && !test.resultsSent) {
//             if (!test.results || test.results.length === 0) {
//                 if (!test.ownerId) {
//                     console.error(`❌ Xatolik: test.ownerId aniqlanmadi! Test: ${test.code}`);
//                     return;
//                 }
//                 bot.sendMessage(test.ownerId, `📊 *Test: ${test.code} Natijalari*\n\n❌ Hech kim ushbu testni ishlamadi.`);
//                 test.resultsSent = true;
//                 fs.writeFileSync(TESTS_FILE, JSON.stringify(tests, null, 2), 'utf8');
//                 return;
//             }

//             // ✅ Foydalanuvchilarni ball bo‘yicha saralash
//             let sortedResults = test.results.sort((a, b) => b.score - a.score);
//             let highestScore = sortedResults[0].score;
//             let winners = sortedResults.filter(user => user.score === highestScore);

//             let resultsText = `📊 *Test: ${test.code} Natijalari*\n\n`;

//             sortedResults.forEach((user, index) => {
//                 let username = user.username ? `@${user.username}` : `ID:${user.userId}`;
//                 resultsText += `${index + 1}. ${username} - ${user.score} ball (${user.userAnswers})\n`;
//             });

//             let winnerText = winners.map(user => user.username ? `@${user.username}` : `ID:${user.userId}`).join(', ');
//             resultsText += `\n🏆 **G'olib:** ${winnerText} - ${highestScore} ball!`;

//             if (!test.ownerId) {
//                 console.error(`❌ Xatolik: test.ownerId aniqlanmadi! Test: ${test.code}`);
//                 return;
//             }

//             bot.sendMessage(test.ownerId, resultsText, { parse_mode: "Markdown" })
//                 .catch(err => console.error(`❌ Xabar yuborishda xatolik:`, err.message));

//             test.resultsSent = true;
//             fs.writeFileSync(TESTS_FILE, JSON.stringify(tests, null, 2), 'utf8');

//             console.log(`📢 Test ${test.code} natijalari chiqarildi!`);
//         }
//     });

//     // Har 1 daqiqada tekshirish
//     setTimeout(() => scheduleTestResults(bot), 60000);
// }



function saveTests(tests) {
    fs.writeFileSync(TESTS_FILE, JSON.stringify(tests, null, 2));
}
function saveResult(msg) {
    console.log("User info:", msg.from); // msg funksiya argumenti sifatida keladi
}

const CHANNEL_IDS = ["@KomilCoding", "@husanov_blog"]; // Kanallaringiz username'larini kiriting

async function isUserMember(userId) {
    try {
        for (const channel of CHANNEL_IDS) {
            const res = await bot.getChatMember(channel, userId);
            if (!["member", "administrator", "creator"].includes(res.status)) {
                return false; // Agar foydalanuvchi bitta kanalga ham a'zo bo'lmasa, false qaytaradi
            }
        }
        return true; // Foydalanuvchi ikkala kanalga ham a'zo bo'lsa, true qaytaradi
    } catch (error) {
        console.error("Error checking membership:", error);
        return false;
    }
}


// 🏁 Botni boshlash
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, "Kerakli bo‘limni tanlang:", {
        reply_markup: {
            keyboard: [
                [{ text: "Kurslar" }, { text: "Aloqa uchun" }],
                [{ text: "Admin Panel" }, { text: "Test" }, { text: "Test natijalari" }]
            ],
            resize_keyboard: true,
        },
    });
});

// 📚 Kurslar ro‘yxati
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    if (!(await isUserMember(chatId, userId))) {
        return bot.sendMessage(chatId, `❌ Siz quyidagi kanallarga a'zo bo'lishingiz kerak:\n\n${CHANNEL_IDS.map(c => "➡ " + c).join("\n")}`);
    }

    // Agar foydalanuvchi kanalga a'zo bo'lsa, kod davom etadi:
    const text = msg.text;
    saveResult(msg);

    let courses = loadCourses(); // Kurslarni yuklash
    if (text === "Kurslar") {
        let buttons = courses.map(course => [{ text: course.name }]);
        bot.sendMessage(chatId, "📚 *Kurslar roʻyxati:*", {
            reply_markup: { keyboard: [...buttons, [{ text: "Orqaga" }]], resize_keyboard: true },
            parse_mode: "Markdown"
        });
    }

    // Kurs nomiga mos bo'lsa, uni chiqarish
    else {
        let selectedCourse = courses.find(course => course.name === text);
        if (selectedCourse) {
            bot.sendMessage(chatId, `📚 *${selectedCourse.name}*\n\n${selectedCourse.info}`, { parse_mode: "Markdown" });
        }
    }

    // 📞 Aloqa
    if (text === "Aloqa uchun") {
        bot.sendMessage(chatId, "Biz bilan bog‘lanish uchun: \n📞 Telefon: +998888988335 \n📞 Telefon: +998978988335  \n📲 Telegram: @umar_bahodirovich_1");
    }

    // 🔑 Admin panel
    else if (text === "Admin Panel") {
        if (chatId.toString() === ADMIN_ID) {
            bot.sendMessage(chatId, "Admin parolini kiriting:");
            adminSessions.add(chatId);
        } else {
            bot.sendMessage(chatId, "❌ Siz admin emassiz!");
        }
    }

    else if (adminSessions.has(chatId) && text === ADMIN_PASSWORD) {
        bot.sendMessage(chatId, "✅ Admin paneliga kirdingiz.", {
            reply_markup: {
                keyboard: [
                    [{ text: "Kurs qo‘shish" }],
                    [{ text: "Test qo‘shish" }],
                    [{ text: "Orqaga" }]
                ],
                resize_keyboard: true,
            },
        });
        adminSessions.delete(chatId);
    }

    // 🔙 Orqaga qaytish
    else if (text === "Orqaga") {
        bot.sendMessage(chatId, "Kerakli bo‘limni tanlang:", {
            reply_markup: {
                keyboard: [
                    [{ text: "Kurslar" }, { text: "Aloqa uchun" }],
                    [{ text: "Admin Panel" }, { text: "Test" }, { text: "Test natijalari" }]
                ],
                resize_keyboard: true,
            },
        });
        delete pendingActions[chatId];
    }

    // ➕ Kurs qo‘shish
    else if (text === "Kurs qo‘shish") {
        pendingActions[chatId] = { action: 'add_course' };
        bot.sendMessage(chatId, "Kurs nomini kiriting:");
    }

    else if (pendingActions[chatId]?.action === 'add_course' && !pendingActions[chatId].courseName) {
        pendingActions[chatId].courseName = text;
        bot.sendMessage(chatId, "Kurs haqida qisqacha ma‘lumot kiriting:");
    }

    else if (pendingActions[chatId]?.action === 'add_course' && pendingActions[chatId].courseName) {
        let courses = loadCourses();
        courses.push({ name: pendingActions[chatId].courseName, info: text });
        saveCourses(courses);
        bot.sendMessage(chatId, `✅ "${pendingActions[chatId].courseName}" kursi qo‘shildi.`);
        delete pendingActions[chatId];
    }

    // Test qo‘shish (Admin paneldan)
    else if (text === "Test qo‘shish") {
        pendingActions[chatId] = { action: 'add_test' };
        bot.sendMessage(chatId, "Test kodi kiriting:");
    }

    // Test kodi kiritish
    else if (pendingActions[chatId]?.action === 'add_test' && !pendingActions[chatId].code) {
        pendingActions[chatId].code = text;
        bot.sendMessage(chatId, "Test uchun to‘g‘ri javoblarni kiriting (masalan: ABCDCBA):");
    }

    // ✅ TO‘G‘RI JAVOBLARNI SAQLASH  
    else if (pendingActions[chatId]?.action === 'add_test' && !pendingActions[chatId].correctAnswers) {
        pendingActions[chatId].correctAnswers = text; // Javoblarni saqlaymiz
        bot.sendMessage(chatId, "Test boshlanish va tugash vaqtini HH:MM-HH:MM formatida kiriting:");
    }

    // ✅ VAQT KIRITISH  
    else if (pendingActions[chatId]?.action === 'add_test' && pendingActions[chatId].correctAnswers) {
        let timeRange = text.split('-');

        if (timeRange.length !== 2 || !/^\d{2}:\d{2}$/.test(timeRange[0]) || !/^\d{2}:\d{2}$/.test(timeRange[1])) {
            bot.sendMessage(chatId, "❌ Noto‘g‘ri format! Vaqtni HH:MM-HH:MM shaklida kiriting (masalan: 20:00-22:00).");
            return;
        }

        let startTime = moment(timeRange[0], "HH:mm", true);
        let endTime = moment(timeRange[1], "HH:mm", true);

        if (!startTime.isValid() || !endTime.isValid()) {
            bot.sendMessage(chatId, "❌ Noto‘g‘ri vaqt! HH:MM formatida yozing.");
            return;
        }

        if (startTime.isAfter(endTime)) {
            bot.sendMessage(chatId, "❌ Xatolik! Test boshlanish vaqti tugash vaqtidan oldin bo‘lishi kerak.");
            return;
        }

        let tests = loadTests();
        tests.push({
            code: pendingActions[chatId].code,
            correctAnswers: pendingActions[chatId].correctAnswers,
            startTime: startTime.format("HH:mm"),
            endTime: endTime.format("HH:mm"),
            results: []
        });

        saveTests(tests);
        bot.sendMessage(chatId, `✅ Test "${pendingActions[chatId].code}" muvaffaqiyatli qo‘shildi!\n🕒 Boshlanish vaqti: ${startTime.format("HH:mm")}\n⏳ Tugash vaqti: ${endTime.format("HH:mm")}`);

        delete pendingActions[chatId];
    }



    // 🎯 Test topshirish (foydalanuvchi test kodini kiritishi kerak)
    else if (text === "Test") {
        pendingActions[chatId] = { action: 'enter_test_code' };
        bot.sendMessage(chatId, "📌 Iltimos, test kodini kiriting:");
    }

    // ✅ Test kodini tekshirish va testni boshlash
    else if (pendingActions[chatId]?.action === 'enter_test_code') {
        let tests = loadTests();
        let test = tests.find(t => t.code === text);
    
        if (!test) {
            bot.sendMessage(chatId, "❌ Bunday test topilmadi.");
            delete pendingActions[chatId];
            return;
        }
    
        let now = moment().tz("Asia/Tashkent").format("HH:mm"); // Joriy vaqtni olish
        let startTime = test.startTime; // Test boshlanish vaqti
        let endTime = test.endTime; // Test tugash vaqti
    
        if (now < startTime) {
            bot.sendMessage(chatId, `⏳ Test hali boshlanmagan! Test ${test.startTime} da boshlanadi.`);
            delete pendingActions[chatId];
            return;
        } else if (now > endTime) {
            bot.sendMessage(chatId, `❌ Test vaqti tugagan! Test ${test.endTime} da tugagan.`);
            delete pendingActions[chatId];
            return;
        }
    
        // ✅ Testni boshlash
        pendingActions[chatId] = { action: "waiting_for_answer", testId: test.code };
        bot.sendMessage(chatId, "✅ Test boshlandi! Endi javoblaringizni yuboring.");
    }
    
    else if (pendingActions[chatId]?.action === "waiting_for_answer") {
        let test = loadTests().find(t => t.code === pendingActions[chatId].testId);
        
        if (!test) {
            delete pendingActions[chatId];
            return bot.sendMessage(chatId, "❌ Test topilmadi.");
        }
    
        let now = moment().tz("Asia/Tashkent").format("HH:mm");
    
        // ✅ Agar test vaqti tugagan bo'lsa, javoblarni qabul qilmaymiz
        if (test.endTime && now > test.endTime) {
            delete pendingActions[chatId]; // 🔥 Foydalanuvchini test rejimidan chiqaramiz
            return bot.sendMessage(chatId, `⛔ Test vaqti tugagan! Endi javob yuborish mumkin emas.`);
        }
    
        // ✅ To'g'ri javoblar test obyektidan olinadi
        let correctAnswers = test.correctAnswers;
        if (!correctAnswers || correctAnswers.length === 0) {
            return bot.sendMessage(chatId, "❌ Xatolik: Test uchun to'g'ri javoblar topilmadi.");
        }
    
        // ✅ Foydalanuvchining javoblarini qayta ishlash
        let userAnswers = text.trim().toUpperCase().split('');
    
        if (userAnswers.length !== correctAnswers.length) {
            return bot.sendMessage(chatId, `❌ Xatolik: Siz ${correctAnswers.length} ta javob kiritishingiz kerak!`);
        }
    
        // ✅ Natijalarni solishtirish va belgilash
        let results = userAnswers.map((answer, index) => 
            `${answer} ${answer === correctAnswers[index] ? '✅' : '❌'}`
        );
    
        let score = userAnswers.filter((answer, index) => answer === correctAnswers[index]).length;
        let percentage = ((score / correctAnswers.length) * 100).toFixed(2);
    
        // ✅ Natijalarni saqlash
        saveTestResult(test.code, chatId, userAnswers.join(''), score);
    
        // 📝 Foydalanuvchiga natijani yuborish
        bot.sendMessage(
            chatId,
            `📊 *Sizning natijangiz:*\n${results.join('\n')}\n\n✅ *To'g'ri javoblar:* ${score}/${correctAnswers.length}\n📈 *Foiz:* ${percentage}%`,
            { parse_mode: "Markdown" }
        );
        
        delete pendingActions[chatId]; // Foydalanuvchini test rejimidan chiqarish
    }
    
    
    
    
    
    
    
    




//test natijalari
    if (text === "Test natijalari") {
        pendingActions[chatId] = { action: 'enter_result_code' };
        bot.sendMessage(chatId, "📌 Iltimos, test kodini kiriting:");
    } else if (pendingActions[chatId]?.action === 'enter_result_code') {
        let testCode = text.trim();
        let tests = loadTests();
        let test = tests.find(t => String(t.code) === String(testCode));
    
        if (!test) {
            bot.sendMessage(chatId, "❌ Bunday test topilmadi. Iltimos, test kodini to‘g‘ri kiriting.");
            delete pendingActions[chatId];
            return;
        }
    
        if (!Array.isArray(test.results) || test.results.length === 0) {
            bot.sendMessage(chatId, "📭 Ushbu test bo‘yicha hali hech qanday natija mavjud emas.");
            delete pendingActions[chatId];
            return;
        }
    
        let sortedResults = [...test.results].sort((a, b) => b.score - a.score);
        let bestUser = sortedResults[0];
    
        let resultMessage = `📊 *Test natijalari (${testCode})*:\n\n`;
    
        let promises = sortedResults.map((res, index) => {
            return bot.getChat(res.userId) // 🆕 Telegramdan username olish
                .then(user => {
                    let userDisplayName = user.username ? `@${user.username}` : user.first_name || "Noma’lum";
                    resultMessage += `🏅 *${index + 1}-o‘rin*\n`;
                    resultMessage += `👤 *Foydalanuvchi:* ${userDisplayName}\n`;
                    resultMessage += `🎯 *To‘g‘ri javoblar:* ${res.score}\n`;
                    resultMessage += `———————————————\n`;
                })
                .catch(() => {
                    resultMessage += `🏅 *${index + 1}-o‘rin*\n`;
                    resultMessage += `👤 *Foydalanuvchi:* Noma’lum\n`;
                    resultMessage += `🎯 *To‘g‘ri javoblar:* ${res.score}\n`;
                    resultMessage += `———————————————\n`;
                });
        });
    
        Promise.all(promises).then(() => {
            bot.sendMessage(chatId, resultMessage, { parse_mode: "Markdown" });
            delete pendingActions[chatId];
        });
    }
    




});




console.log("Bot is running...");
