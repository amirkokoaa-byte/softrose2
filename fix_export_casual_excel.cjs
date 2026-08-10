const fs = require('fs');
let content = fs.readFileSync('components/LeaveBalance.tsx', 'utf8');

// Inside handleExportExcel loop, we need to track casual per month
// and apply the rule

let originalLogic = `                    } else if (type === 'summer') {
                        attIn = "إجازة";
                        attOut = "سنوي";
                        notes = "إجازة مصيف";
                    } else if (type === 'annual' || type === 'casual' || type === 'custom') {
                        monthlyLeaveCount[monthKey]++;
                        if (monthlyLeaveCount[monthKey] > 2) {
                            attIn = "غياب";
                            attOut = "بإذن";
                            notes = "تخصم من الراتب";
                        } else {
                            attIn = "إجازة";
                            attOut = typeLabels[type] || leaveRecord.customLabel || "سنوي";
                        }
                    } else {`;

let newLogic = `                    } else if (type === 'summer') {
                        attIn = "إجازة";
                        attOut = "سنوي";
                        notes = "إجازة مصيف";
                    } else if (type === 'casual') {
                        monthlyLeaveCount[monthKey]++;
                        // Check if casual balance is exhausted and annual is exhausted
                        let isSalaryDeduction = false;
                        if (monthlyLeaveCount[monthKey] > 2) {
                            isSalaryDeduction = true; // Exceeded monthly casual limit
                        }
                        
                        // User requested: "وفي حاله انهاء رصيد العارضه وانتهاء رصيد السنوي يتم ظهور في خانه الملاحظات في الاكسيل تخصم من الراتب"
                        // Since we just have the current balance, we can check it
                        const casualBal = Number(uBalance.casual || 0);
                        const annualBal = Number(uBalance.annual || 0);
                        if (casualBal <= 0 && annualBal <= 0) {
                            isSalaryDeduction = true;
                        }

                        if (isSalaryDeduction) {
                            attIn = "غياب";
                            attOut = "بإذن";
                            notes = "تخصم من الراتب";
                        } else {
                            attIn = "إجازة";
                            attOut = typeLabels[type] || "عارضة";
                            if (monthlyLeaveCount[monthKey] > 2 && annualBal > 0) {
                                notes = "تخصم من السنوي لتخطي العارضة";
                            } else if (casualBal <= 0 && annualBal > 0) {
                                notes = "تخصم من السنوي لانتهاء العارضة";
                            }
                        }
                    } else if (type === 'annual' || type === 'custom') {
                        const annualBal = Number(uBalance.annual || 0);
                        if (annualBal <= 0) {
                            attIn = "غياب";
                            attOut = "بإذن";
                            notes = "تخصم من الراتب لانتهاء السنوي";
                        } else {
                            attIn = "إجازة";
                            attOut = typeLabels[type] || leaveRecord.customLabel || "سنوي";
                        }
                    } else {`;

content = content.replace(originalLogic, newLogic);
fs.writeFileSync('components/LeaveBalance.tsx', content);
