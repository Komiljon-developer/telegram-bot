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

let adminSessions = new Set();
let pendingActions = {};

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

function saveTestResult(testCode, userId, userAnswers, score) {
    let tests = loadTests(); // `test.json` faylidan barcha testlarni yuklash
    let test = tests.find(t => String(t.code) === String(testCode)); // Berilgan kod bo‘yicha testni topish
    
    if (!test) {
        console.error("❌ Xatolik: Test topilmadi!");
        return;
    }

    // Agar testda `results` bo‘lmasa, uni yaratamiz
    if (!Array.isArray(test.results)) {
        test.results = [];
    }

    // ❗️ Natija allaqachon mavjudligini tekshiramiz (yo‘q bo‘lsa, qo‘shamiz)
    let existingResult = test.results.find(r => r.userId === userId);
    if (existingResult) {
        existingResult.score = score; // Agar foydalanuvchi natijasi bor bo‘lsa, yangilaymiz
    } else {
        test.results.push({ userId, userAnswers, score }); // Yangi natijani qo‘shamiz
    }

    // ✅ Yangilangan `tests` massivini `test.json` fayliga saqlaymiz
    fs.writeFileSync('test.json', JSON.stringify(tests, null, 2), 'utf8');
    
    console.log("✅ Natija saqlandi:", { testCode, userId, userAnswers, score });
}



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
        bot.sendMessage(chatId, "Biz bilan bog‘lanish uchun: \n📞 Telefon: +998 90 123 45 67\n📧 Email: info@dastur.uz");
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

    // ➕ Test qo‘shish (vaqt qo'shildi)
    else if (text === "Test qo‘shish") {
        pendingActions[chatId] = { action: 'add_test' };
        bot.sendMessage(chatId, "Test kodi kiriting:");
    }

    else if (pendingActions[chatId]?.action === 'add_test' && !pendingActions[chatId].code) {
        pendingActions[chatId].code = text;
        bot.sendMessage(chatId, "Test uchun to‘g‘ri javoblarni kiriting (masalan: ABCDCBA):");
    }

    else if (pendingActions[chatId]?.action === 'add_test' && pendingActions[chatId].code && !pendingActions[chatId].correctAnswers) {
        pendingActions[chatId].correctAnswers = text.toUpperCase().split('');
        bot.sendMessage(chatId, "Test boshlanish va tugash vaqtini HH:MM-HH:MM formatida kiriting (masalan: 20:00-22:00):");
    }

    else if (pendingActions[chatId]?.action === 'add_test' && pendingActions[chatId].correctAnswers) {
        let timeRange = text.split('-');
        if (timeRange.length !== 2 || !/^\d{2}:\d{2}$/.test(timeRange[0]) || !/^\d{2}:\d{2}$/.test(timeRange[1])) {
            bot.sendMessage(chatId, "❌ Noto‘g‘ri format! Vaqtni HH:MM-HH:MM ko‘rinishida kiriting.");
            return;
        }

        let tests = loadTests();
        tests.push({
            code: pendingActions[chatId].code,
            correctAnswers: pendingActions[chatId].correctAnswers,
            startTime: timeRange[0],
            endTime: timeRange[1],
            results: []
        });

        saveTests(tests);
        bot.sendMessage(chatId, ` ✅ Test "${pendingActions[chatId].code}" qo‘shildi.`);
        delete pendingActions[chatId];
    }

    // 🎯 Test topshirish (foydalanuvchi test kodini kiritishi kerak)
    else if (text === "Test") {
        pendingActions[chatId] = { action: 'enter_test_code' };
        bot.sendMessage(chatId, "📌 Iltimos, test kodini kiriting:");
    }

    // Test kodini tekshirish va testni boshlash
    else if (pendingActions[chatId]?.action === 'enter_test_code') {
        let tests = loadTests();
        let test = tests.find(t => t.code === text);

        if (!test) {
            bot.sendMessage(chatId, "❌ Bunday test topilmadi.");
            delete pendingActions[chatId];
            return;
        }

        let now = new Date();
        let [startHour, startMinute] = test.startTime.split(':').map(Number);
        let [endHour, endMinute] = test.endTime.split(':').map(Number);

        let startTime = new Date(now);
        startTime.setHours(startHour, startMinute, 0, 0);

        let endTime = new Date(now);
        endTime.setHours(endHour, endMinute, 0, 0);

        if (now < startTime) {
            bot.sendMessage(chatId, `⏳ Test hali boshlanmagan! Test ${test.startTime} da boshlanadi.`);
            delete pendingActions[chatId];
            return;
        } else if (now > endTime) {
            bot.sendMessage(chatId, `❌ Test vaqti tugagan! Test ${test.endTime} da tugagan.`);
            delete pendingActions[chatId];
            return;
        }

        // 🔹 Test kodini kiritgandan so‘ng javoblarni qabul qilish uchun action o‘zgartirish
        pendingActions[chatId] = { action: "waiting_for_answer", testId: test.code };
        bot.sendMessage(chatId, "✅ Test boshlandi! Endi javoblaringizni yuboring.");
    }

    // Test javoblarini qabul qilish
    else if (pendingActions[chatId]?.action === "waiting_for_answer") {
        let test = loadTests().find(t => t.code === pendingActions[chatId].testId);
        if (!test) {
            bot.sendMessage(chatId, "❌ Test topilmadi.");
            delete pendingActions[chatId];
            return;
        }

        let now = new Date();
        let [startHour, startMinute] = test.startTime.split(':').map(Number);
        let [endHour, endMinute] = test.endTime.split(':').map(Number);

        let startTime = new Date(now);
        startTime.setHours(startHour, startMinute, 0, 0);

        let endTime = new Date(now);
        endTime.setHours(endHour, endMinute, 0, 0);

        if (now < startTime) {
            bot.sendMessage(chatId, `⏳ Test hali boshlanmagan! Test ${test.startTime} da boshlanadi.`);
            return;
        } else if (now > endTime) {
            bot.sendMessage(chatId, `⛔ Test vaqti tugagan! Test ${test.endTime} da tugagan.`);
            return;
        }

        // 🔹 Foydalanuvchining javoblarini tekshirish
        let userAnswers = text.toUpperCase().split('');
        let correctAnswers = test.correctAnswers;

        if (userAnswers.length !== correctAnswers.length) {
            bot.sendMessage(chatId, `❌ Xatolik: Siz ${correctAnswers.length} ta javob kiritishingiz kerak!`);
            return;
        }

        let correctCount = 0;
        let incorrectAnswers = [];

        userAnswers.forEach((ans, i) => {
            if (ans === correctAnswers[i]) {
                correctCount++;
            } else {
                incorrectAnswers.push(`${i + 1}-savol: ❌ Sizning javobingiz: ${ans}, ✅ To‘g‘ri javob: ${correctAnswers[i]}`);
            }
        });

        let tests = loadTests(); // ✅ Testlar ro‘yxatini yuklash

        // 🔹 Natijalarni test bazasiga saqlash
        test.results.push({
            id: msg.chat.id,
            name: msg.from.first_name || "Ism yo'q",
            username: msg.from.username || "Username yo'q",
            correct: correctCount
        });

        saveTests(tests); // ✅ Xatolik endi yuzaga kelmaydi


        let percentage = Math.round((correctCount / correctAnswers.length) * 100);

        let resultMessage = `📋 *Test natijalari:*

✅ *To'g'ri javoblar:* ${correctAnswers.join(', ')}
📥 *Sizning javoblaringiz:* ${userAnswers.join(', ')}
🎯 *To'g'ri javoblar soni:* ${correctCount}/${correctAnswers.length} (${percentage}%)\n\n`;

        if (incorrectAnswers.length > 0) {
            resultMessage += `🚨 *Xatolar:* \n` + incorrectAnswers.join('\n');
        }

        bot.sendMessage(chatId, resultMessage, { parse_mode: "Markdown" });
        delete pendingActions[chatId];
    }




    //test natijalari

    else if (text === "Test natijalari") {
        bot.sendMessage(chatId, "📌 Iltimos, test kodini kiriting:");
        pendingActions[chatId] = { action: 'enter_result_code' };
    }
    
    else if (pendingActions[chatId]?.action === 'enter_result_code') {
        let testCode = text.trim(); // Test kodini olish
        let tests = loadTests(); // Barcha testlarni yuklash
        let test = tests.find(t => String(t.code) === String(testCode)); // Testni topish
    
        if (!test) {
            bot.sendMessage(chatId, "❌ Bunday test topilmadi. Iltimos, test kodini to‘g‘ri kiriting.");
            return;
        }
    
        let now = Date.now(); // Hozirgi vaqtni olish
        let endTime = new Date();
        let [endHour, endMinute] = test.endTime.split(':').map(Number);
        endTime.setHours(endHour, endMinute, 0, 0);
    
        if (now < endTime.getTime()) {
            bot.sendMessage(chatId, "⏳ Bu test hali yakunlanmagan. Natijalarni test tugagandan keyin ko‘rishingiz mumkin.");
            return;
        }
    
        if (!Array.isArray(test.results) || test.results.length === 0) {
            bot.sendMessage(chatId, "📭 Ushbu test bo‘yicha hali hech qanday natija mavjud emas.");
            return;
        }
    
        // 🔍 Natijalarni chiqarish
        let sortedResults = [...test.results].sort((a, b) => b.correct - a.correct); // Kim eng ko‘p to‘g‘ri ishlagan
        let bestUser = sortedResults[0]; // Eng yaxshi natija
        let resultMessage = `📊 *Test natijalari (${testCode})*:\n\n`;
    
        sortedResults.forEach((res, index) => {
            resultMessage += `🏅 *${index + 1}-o‘rin*\n`;
            resultMessage += `👤 *Ism:* ${res.name || "Noma’lum"}\n`;
            resultMessage += `🔹 *Username:* ${res.username ? `@${res.username}` : "Noma’lum"}\n`;
            resultMessage += `🎯 *To‘g‘ri javoblar:* ${res.correct}/${test.correctAnswers.length} ta\n`;
            resultMessage += `———————————————\n`;
        });
        saveTestResult();
        resultMessage += `\n🥇 *Eng yaxshi natija:* ${bestUser.correct}/${test.correctAnswers.length} ta - ${bestUser.name}`;
    
        bot.sendMessage(chatId, resultMessage, { parse_mode: "Markdown" });
        delete pendingActions[chatId]; // Foydalanuvchi holatini tozalash
    }
    
});




console.log("Bot is running...");
