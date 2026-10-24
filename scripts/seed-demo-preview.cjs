// Seed a realistic demo business for live page previews.
const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");

const PASSWORD_HASH = bcrypt.hashSync("Demo-Preview-2026!", 10);

async function main() {
  const db = await mysql.createConnection({
    host: "127.0.0.1", user: "trueaxis", password: "trueaxis", database: "trueaxis", multipleStatements: false,
  });

  // Fresh start for the demo owner.
  const [[existing]] = await db.query("SELECT id FROM users WHERE email='demo@trueaxis.hq'");
  if (existing) {
    for (const t of ["invoices", "jobs", "bookings", "clients"]) {
      await db.query(`DELETE FROM ${t} WHERE userId=?`, [existing.id]);
    }
    await db.query("DELETE FROM users WHERE id=?", [existing.id]);
  }

  const [res] = await db.query(
    `INSERT INTO users (openId, name, email, loginMethod, role, createdAt, updatedAt, planId, phone,
       businessName, businessPhone, businessAddress, businessWebsite, bookingUsername, bookingBio,
       bookingServices, notifyNewBooking, notifyInvoicePaid, notifyNewLead, passwordHash)
     VALUES (?,?,?,?,?,NOW(),NOW(),'pro',?,?,?,?,?,?,?,?,1,1,1,?)`,
    ["demo-preview", "Alex Rivera", "demo@trueaxis.hq", "password", "user", "+14155550100",
     "Rivera Plumbing & HVAC", "+14155550100", "482 Mission St, San Francisco, CA 94105",
     "https://riveraplumbing.example.com", "rivera-plumbing",
     "Family-owned plumbing and HVAC shop serving the Bay Area since 2011. Licensed, insured, and on-time.",
     JSON.stringify([
      { name: "Water heater install", durationMinutes: 180, active: true, priceGuidance: "from $1,200", depositAmountCents: 15000 },
      { name: "Drain cleaning", durationMinutes: 90, active: true, priceGuidance: "from $180", depositAmountCents: null },
      { name: "HVAC tune-up", durationMinutes: 120, active: true, priceGuidance: "from $150", depositAmountCents: null },
      { name: "Emergency repair", durationMinutes: 60, active: true, priceGuidance: "diagnostic $95", depositAmountCents: null },
    ]), PASSWORD_HASH]
  );
  const u = res.insertId;
  console.log("owner id", u);

  const clients = [
    ["Maria Gonzalez","maria.gonzalez@example.com","+14155550111","Water heater replacement","active","Two-story home; shutoff valve is in the garage.","MG",2450.00,6,"active",1],
    ["James Chen","jchen@example.com","+14155550112","HVAC tune-up","active","Rooftop unit; roof access code 4471.","JC",1180.00,4,"active",1],
    ["Priya Patel","priya.patel@example.com","+14155550113","Drain cleaning","active","Recurring clog in kitchen line; camera inspection advised.","PP",640.00,2,"active",0],
    ["Daniel Okafor","d.okafor@example.com","+14155550114","Emergency leak repair","active","Late-night emergency line customer.","DO",1890.00,5,"active",1],
    ["Sarah Whitfield","sarah.w@example.com","+14155550115","Bathroom remodel rough-in","prospect","Comparing two bids; decision by month-end.","SW",0,0,"proposal_sent",1],
    ["Tom & Lisa Berger","bergers@example.com","+14155550116","Sump pump install","prospect","Referred by Maria Gonzalez.","TB",0,0,"inquiry",0],
    ["Kevin Ruiz","kruiz@example.com","+14155550117","Furnace inspection","active","Annual maintenance plan candidate.","KR",320.00,1,"active",1],
    ["Aisha Mohammed","aisha.m@example.com","+14155550118","Garbage disposal swap","inactive","Job done; asked for the Google review link.","AM",415.00,1,"completed",1],
  ];
  const cid = {}; // 1-based seed position -> real inserted client id
  for (let i = 0; i < clients.length; i++) {
    const c = clients[i];
    const [res] = await db.query(
      `INSERT INTO clients (userId,name,email,phone,service,status,notes,avatarInitials,totalRevenue,sessionsCount,createdAt,updatedAt,lastContactedAt,pipelineStage,smsOptIn)
       VALUES (${"?".repeat(1) + ",?".repeat(9)},NOW(),NOW(),NOW(),?,?)`, [u, ...c]
    ).catch(e => { console.log("client err", c[0], e.message); return [null]; });
    if (res && res.insertId) cid[i + 1] = res.insertId;
  }
  console.log("client id map", JSON.stringify(cid));

  const bookings = [
    [1,"Maria Gonzalez","maria.gonzalez@example.com","Water heater replacement","2026-10-26","09:00",180,"scheduled","Bring 50-gal Rheem; confirm disposal of old unit.",25000,"required","+14155550111"],
    [2,"James Chen","jchen@example.com","HVAC fall tune-up","2026-10-26","13:30",90,"scheduled","Rooftop access 4471.",0,"waived","+14155550112"],
    [3,"Priya Patel","priya.patel@example.com","Drain camera inspection","2026-10-27","10:00",120,"scheduled","Kitchen line camera scope.",0,"waived","+14155550113"],
    [4,"Daniel Okafor","d.okafor@example.com","Leak follow-up visit","2026-10-24","08:30",60,"completed","Repaired supply line; pressure tested.",0,"paid","+14155550114"],
  ];
  for (const b of bookings) {
    await db.query(
      `INSERT INTO bookings (userId,clientId,clientName,clientEmail,service,date,time,duration,status,notes,isPublicBooking,createdAt,updatedAt,depositAmountCents,depositStatus,clientPhone)
       VALUES (?,?,?,?,?,?,?,?,?,?,0,NOW(),NOW(),?,?,?)`, [u, cid[b[0]] ?? null, ...b.slice(1)]
    ).catch(e => console.log("booking err", b[1], e.message));
  }

  let jobSeq = 1;
  const jobs = [
    [1,"Water heater replacement — Gonzalez","Replace 40-gal unit with 50-gal Rheem, new expansion tank, haul away old heater.","scheduled","high","2026-10-26","2026-10-26",2450.00],
    [2,"HVAC fall tune-up — Chen","Full seasonal tune-up: coils, refrigerant check, filter replacement.","in_progress","normal","2026-10-26","2026-10-26",380.00],
    [4,"Emergency supply line repair — Okafor","Late-night call; repaired burst supply line, dry-out assessment.","completed","urgent","2026-10-24","2026-10-24",1890.00],
    [5,"Bathroom rough-in — Whitfield","Full rough-in for guest bathroom remodel; two bids out.","quoted","normal","2026-11-02","2026-11-13",7800.00],
    [6,"Sump pump install — Berger","Install battery-backup sump pump in crawlspace.","lead","low",null,null,1200.00],
    [8,"Garbage disposal swap — Mohammed","Replace failed disposal with 3/4 HP unit.","completed","normal","2026-10-20","2026-10-20",415.00],
  ];
  for (const j of jobs) {
    const jobNumber = "JOB-" + (2000 + jobSeq++);
    await db.query(
      `INSERT INTO jobs (userId,clientId,jobNumber,title,description,status,priority,startDate,targetDate,budgetAmount,createdAt,updatedAt)
       VALUES (?,?,?,?,?,?,?,?,?,?,NOW(),NOW())`, [u, cid[j[0]] ?? null, jobNumber, ...j.slice(1)]
    ).catch(e => console.log("job err", j[2], e.message));
  }

  const invoices = [
    [1,"INV-1041","Maria Gonzalez","maria.gonzalez@example.com","Water heater replacement (50% deposit)",1225.00,"paid","2026-10-10","Deposit received online.",'[{"description":"Water heater replacement — deposit","quantity":1,"rate":1225}]'],
    [4,"INV-1040","Daniel Okafor","d.okafor@example.com","Emergency leak repair",1890.00,"paid","2026-10-23","Paid same night, thank-you.",'[{"description":"Emergency leak repair","quantity":1,"rate":1890}]'],
    [8,"INV-1039","Aisha Mohammed","aisha.m@example.com","Garbage disposal swap",415.00,"paid","2026-10-21","",'[{"description":"Garbage disposal swap","quantity":1,"rate":415}]'],
    [2,"INV-1042","James Chen","jchen@example.com","HVAC fall tune-up",380.00,"sent","2026-11-05","",null,'[{"description":"HVAC fall tune-up","quantity":1,"rate":380}]'],
    [3,"INV-1037","Priya Patel","priya.patel@example.com","Drain cleaning + camera inspection",640.00,"overdue","2026-10-05","Reminder sent Oct 12.",null,'[{"description":"Drain cleaning","quantity":1,"rate":280},{"description":"Camera inspection","quantity":1,"rate":360}]'],
    [7,"INV-1043","Kevin Ruiz","kruiz@example.com","Furnace inspection",320.00,"draft","2026-11-01","",null,'[{"description":"Furnace inspection","quantity":1,"rate":320}]'],
  ];
  for (const iv of invoices) {
    const paid = iv[6] === "paid";
    if (paid) {
      await db.query(
        `INSERT INTO invoices (userId,clientId,invoiceNumber,clientName,clientEmail,service,amount,status,dueDate,notes,paidAt,createdAt,updatedAt,lineItems)
         VALUES (?,?,?,?,?,?,?,?,?,?,NOW(),NOW(),NOW(),?)`,
        [u, cid[iv[0]] ?? null, iv[1], iv[2], iv[3], iv[4], iv[5], iv[6], iv[7], iv[8], iv[10]]
      ).catch(e => console.log("invoice err", iv[1], e.message));
    } else {
      await db.query(
        `INSERT INTO invoices (userId,clientId,invoiceNumber,clientName,clientEmail,service,amount,status,dueDate,notes,createdAt,updatedAt,lineItems)
         VALUES (?,?,?,?,?,?,?,?,?,?,NOW(),NOW(),?)`,
        [u, cid[iv[0]] ?? null, iv[1], iv[2], iv[3], iv[4], iv[5], iv[6], iv[7], iv[8], iv[10]]
      ).catch(e => console.log("invoice err", iv[1], e.message));
    }
  }

  const [[{ c }]] = await db.query("SELECT COUNT(*) c FROM clients WHERE userId=?", [u]);
  const [[{ j }]] = await db.query("SELECT COUNT(*) j FROM jobs WHERE userId=?", [u]);
  const [[{ i }]] = await db.query("SELECT COUNT(*) i FROM invoices WHERE userId=?", [u]);
  console.log(`seeded: clients=${c} jobs=${j} invoices=${i}`);
  await db.end();
}
main().catch(e => { console.error("FATAL", e.message, "\nSQL:", e.sql || "(n/a)"); process.exit(1); });
