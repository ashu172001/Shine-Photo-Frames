import React, { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import "./OrderTable.css";

const API_BASE = "https://shine-photo-frames.onrender.com/api/orders";

// Predefined Frame Sizes (sorted)
const FRAME_SIZES = [
  "4x4",
  "4x6",
  "5x7",
  "6x6",
  "6x8",
  "6x9",
  "10x10",
  "8x12",
  "8x16",
  "10x15",
  "10x22",
  "12x15",
  "12x18",
  "12x24",
  "16x22",
  "20x24",
  "20x28",
  "20x30",
  "Other"
];

const OrderTable = () => {
  const [orders, setOrders] = useState({});
  const [expandedMonth, setExpandedMonth] = useState(null);
  const [expandedYear, setExpandedYear] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  const toggleYear = (year) => {
    setExpandedYear((prev) => (prev === year ? null : year));
  };
  
  const [dailyDate, setDailyDate] = useState(new Date().toISOString().split("T")[0]);
  const [expandedDaily, setExpandedDaily] = useState(true);
  const [searchDailyTerm, setSearchDailyTerm] = useState("");

  const [newOrder, setNewOrder] = useState({
    customerName: "",
    phone: "",
    frameSize: "",
    customFrameSize: "",
    quantity: 1,
    price: "",
    advance: "",
    date: new Date().toISOString().split("T")[0],
  });

  // FETCH
  const fetchOrders = async () => {
    const res = await fetch(API_BASE);
    const data = await res.json();
    setOrders(data);
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  // Handle Input Change
  const handleChange = (e) => {
    const { name, value } = e.target;

    setNewOrder((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Add New Order
  const handleAdd = async () => {
    let frameSizeToSend = newOrder.frameSize === "Other"
      ? newOrder.customFrameSize
      : newOrder.frameSize;

    if (!newOrder.customerName || !frameSizeToSend || !newOrder.price) {
      alert("Please fill in all required fields!");
      return;
    }

    const orderBody = {
      customerName: newOrder.customerName,
      phone: newOrder.phone,
      frameSize: frameSizeToSend,
      quantity: newOrder.quantity,
      price: newOrder.price,
      advance: newOrder.advance,
      date: newOrder.date,
    };

    const res = await fetch(API_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(orderBody),
    });

    const createdOrder = await res.json();

    const missingFields = {};
    if (newOrder.advance && createdOrder.advance === undefined) {
      missingFields.advance = Number(newOrder.advance);
    }
    if (newOrder.phone && createdOrder.phone === undefined) {
      missingFields.phone = newOrder.phone;
    }

    if (Object.keys(missingFields).length > 0) {
      await fetch(`${API_BASE}/${createdOrder.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(missingFields),
      });
    }

    // Reset
    setNewOrder({
      customerName: "",
      phone: "",
      frameSize: "",
      customFrameSize: "",
      quantity: 1,
      price: "",
      advance: "",
      date: new Date().toISOString().split("T")[0],
    });

    fetchOrders();
  };

  // Delete Order
  const handleDelete = async (id) => {
    await fetch(`${API_BASE}/${id}`, { method: "DELETE" });
    fetchOrders();
  };

  // Single PDF Invoice
  const downloadSingleInvoice = (order) => {
    const doc = new jsPDF();

    doc.setFontSize(20);
    doc.text("SHINE PHOTO FRAMES GALLERY", 105, 20, null, null, "center");

    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    doc.text("Contact: 8867309101, 9741157821", 105, 27, null, null, "center");

    doc.setFontSize(12);
    doc.setTextColor(100, 100, 100);
    doc.text("INVOICE RECEIPT", 105, 35, null, null, "center");

    doc.line(14, 40, 196, 40);

    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.text(`Date: ${new Date(order.date).toLocaleDateString("en-IN")}`, 14, 48);
    doc.text(`Customer Name: ${order.customerName}`, 14, 55);
    if (order.phone) doc.text(`Phone: ${order.phone}`, 14, 62);

    const balanceAmount = order.isPaid ? 0 : (order.balance !== undefined ? order.balance : ((order.quantity * order.price) - (Number(order.advance) || 0)));
    const advanceAmount = Number(order.advance) || 0;
    const totalAmount = order.quantity * order.price;
    const balanceText = order.isPaid ? "Paid" : `Rs. ${balanceAmount.toLocaleString("en-IN")}`;

    autoTable(doc, {
      startY: 70,
      head: [["Description", "Qty", "Price", "Amount"]],
      body: [
        [`Frame Size: ${order.frameSize}`, order.quantity, `Rs. ${order.price.toLocaleString("en-IN")}`, `Rs. ${totalAmount.toLocaleString("en-IN")}`]
      ],
    });

    const finalY = doc.lastAutoTable.finalY || 70;

    doc.text(`Total Amount: Rs. ${totalAmount.toLocaleString("en-IN")}`, 125, finalY + 15);
    doc.text(`Advance Paid: Rs. ${advanceAmount.toLocaleString("en-IN")}`, 125, finalY + 22);

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(`Balance Due: ${balanceText}`, 125, finalY + 30);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(150, 150, 150);
    doc.text("Thank you for your business!", 105, finalY + 50, null, null, "center");

    doc.save(`${order.customerName.replace(/\s+/g, '_')}_Invoice.pdf`);
  };

  // WhatsApp Bill
  const sendWhatsAppBill = (order) => {
    if (!order.phone) {
      alert("Please enter a phone number for this customer first!");
      return;
    }

    let formattedPhone = order.phone.replace(/\D/g, "");
    if (formattedPhone.length === 10) formattedPhone = `91${formattedPhone}`;

    const balanceAmount = order.isPaid ? 0 : (order.balance !== undefined ? order.balance : ((order.quantity * order.price) - (Number(order.advance) || 0)));
    const advanceAmount = Number(order.advance) || 0;
    const totalAmount = order.quantity * order.price;
    const balanceText = order.isPaid ? "Paid" : `₹${balanceAmount}`;

    const message = `*SHINE PHOTO FRAMES GALLERY*
*Contact:* 8867309101, 9741157821
-----------------------------------
*Customer:* ${order.customerName}
*Date:* ${new Date(order.date).toLocaleDateString("en-IN")}
-----------------------------------
*Frame Size:* ${order.frameSize}
*Quantity:* ${order.quantity}
*Total Amount:* ₹${totalAmount}
*Advance Paid:* ₹${advanceAmount}
*Balance Due:* ${balanceText}
-----------------------------------
_Thank you for your order!_`;

    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/${formattedPhone}?text=${encodedMessage}`, "_blank");
  };

  // Update Order
  const handleEdit = async (month, id, field, value) => {
    await fetch(`${API_BASE}/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
    fetchOrders();
  };

  // Filter
  const filterOrders = (list) => {
    return list.filter(
      (o) =>
        o.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        o.date.includes(searchTerm)
    );
  };

  // EXCEL
  const handleDownloadExcel = (month, data) => {
    const sheetData = data.map((o) => ({
      Date: new Date(o.date).toLocaleDateString("en-IN"),
      "Customer Name": o.customerName,
      "Phone": o.phone || "",
      "Frame Size": o.frameSize,
      Quantity: o.quantity,
      Price: o.price,
      Advance: o.advance || 0,
      Balance: o.isPaid ? "Paid" : (o.balance || 0),
      Total: o.quantity * o.price,
    }));

    const total = data.reduce((s, o) => s + o.quantity * o.price, 0);
    sheetData.push({});
    sheetData.push({ "Customer Name": "Total", Total: total });

    const ws = XLSX.utils.json_to_sheet(sheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, month);
    XLSX.writeFile(wb, `${month}_Orders.xlsx`);
  };

  // PDF
  const handleDownloadPDF = (month, data) => {
    const doc = new jsPDF();
    doc.text(`Frame Orders - ${month}`, 14, 15);

    autoTable(doc, {
      startY: 25,
      head: [["Date", "Customer", "Phone", "Frame Size", "Qty", "Price", "Advance", "Balance", "Total"]],
      body: data.map((o) => [
        new Date(o.date).toLocaleDateString("en-IN"),
        o.customerName,
        o.phone || "",
        o.frameSize,
        o.quantity,
        o.price,
        o.advance || 0,
        o.isPaid ? "Paid" : (o.balance || 0),
        o.quantity * o.price,
      ]),
    });

    const finalY = doc.lastAutoTable.finalY || 25;
    const monthTotalAmount = data.reduce((s, o) => s + (o.quantity * o.price), 0);
    const monthTotalAdvance = data.reduce((s, o) => s + (Number(o.advance) || 0), 0);
    const monthTotalBalance = data.reduce((s, o) => {
      if (o.isPaid) return s;
      const b = o.balance !== undefined ? o.balance : ((o.quantity * o.price) - (Number(o.advance) || 0));
      return s + Number(b);
    }, 0);

    doc.setFontSize(11);
    doc.text(
      `Total for ${month}: Amount Rs. ${monthTotalAmount.toLocaleString("en-IN")} | Advance Rs. ${monthTotalAdvance.toLocaleString("en-IN")} | Balance Rs. ${monthTotalBalance.toLocaleString("en-IN")}`, 
      14, 
      finalY + 10
    );

    doc.save(`${month}_Orders.pdf`);
  };

  const toggleMonth = (month) => {
    setExpandedMonth((prev) => (prev === month ? null : month));
    setSearchTerm("");
  };

  const currentYear = new Date().getFullYear().toString();

  const groupedByYear = {};
  Object.entries(orders).forEach(([monthLabel, monthOrders]) => {
    const parts = monthLabel.split(" ");
    const year = parts[parts.length - 1]; // e.g. "2026"
    if (!groupedByYear[year]) {
      groupedByYear[year] = {};
    }
    groupedByYear[year][monthLabel] = monthOrders;
  });

  const sortedYears = Object.keys(groupedByYear).sort((a, b) => b - a);

  const allOrders = Object.values(orders).flat();
  const overallTotal = allOrders.reduce((s, o) => s + (o.quantity * o.price), 0);
  const overallAdvance = allOrders.reduce((s, o) => s + (Number(o.advance) || 0), 0);
  const overallBalance = allOrders.reduce((s, o) => {
    if (o.isPaid) return s;
    const b = o.balance !== undefined ? o.balance : ((o.quantity * o.price) - (Number(o.advance) || 0));
    return s + Number(b);
  }, 0);

  // --- NEW DAILY CALCULATIONS ---
  const dailyOrders = allOrders.filter(o => o.date === dailyDate);
  const filteredDaily = dailyOrders.filter(
    (o) => o.customerName.toLowerCase().includes(searchDailyTerm.toLowerCase())
  );
  const dailyTotalAmount = filteredDaily.reduce((s, o) => s + (o.quantity * o.price), 0);
  const dailyTotalAdvance = filteredDaily.reduce((s, o) => s + (Number(o.advance) || 0), 0);
  const dailyTotalBalance = filteredDaily.reduce((s, o) => {
    if (o.isPaid) return s;
    const b = o.balance !== undefined ? o.balance : ((o.quantity * o.price) - (Number(o.advance) || 0));
    return s + Number(b);
  }, 0);

  const renderMonthSection = (month, monthOrders) => {
    const filtered = filterOrders(monthOrders);
    const monthTotalAmount = filtered.reduce((s, o) => s + (o.quantity * o.price), 0);
    const monthTotalAdvance = filtered.reduce((s, o) => s + (Number(o.advance) || 0), 0);
    const monthTotalBalance = filtered.reduce((s, o) => {
      if (o.isPaid) return s;
      const b = o.balance !== undefined ? o.balance : ((o.quantity * o.price) - (Number(o.advance) || 0));
      return s + Number(b);
    }, 0);
    const open = expandedMonth === month;

    return (
      <div key={month} className="month-section">
        <div className="month-header" onClick={() => toggleMonth(month)}>
          <h3>
            <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{width: '24px', height: '24px', color: 'var(--accent-purple)'}}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
            </svg>
            {month}
          </h3>

          <div className="download-buttons">
            <div className="search-box" onClick={(e) => e.stopPropagation()}>
              <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{width: '18px', height: '18px'}}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <input
                type="text"
                placeholder="Search orders..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <button className="btn-secondary" onClick={(e) => { e.stopPropagation(); handleDownloadExcel(month, monthOrders); }}>
              <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{width: '18px', height: '18px', color: '#10b981'}}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m.75 12l3 3m0 0l3-3m-3 3v-6m-1.5-9H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
              Excel
            </button>

            <button className="btn-secondary" onClick={(e) => { e.stopPropagation(); handleDownloadPDF(month, monthOrders); }}>
              <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{width: '18px', height: '18px', color: '#ef4444'}}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
              PDF
            </button>
          </div>
        </div>

        {open && (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Customer</th>
                  <th style={{ minWidth: '110px' }}>Phone</th>
                  <th>Frame Size</th>
                  <th style={{ minWidth: '80px', textAlign: 'center' }}>Qty</th>
                  <th>Price</th>
                  <th>Advance</th>
                  <th>Balance</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {filtered.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <input
                        type="date"
                        value={o.date}
                        onChange={(e) => handleEdit(month, o.id, "date", e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={o.customerName}
                        onChange={(e) => handleEdit(month, o.id, "customerName", e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        style={{ minWidth: '110px' }}
                        value={o.phone || ""}
                        onChange={(e) => handleEdit(month, o.id, "phone", e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={o.frameSize}
                        onChange={(e) => handleEdit(month, o.id, "frameSize", e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        style={{ textAlign: 'center', minWidth: '60px' }}
                        value={o.quantity}
                        onChange={(e) => handleEdit(month, o.id, "quantity", Number(e.target.value))}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        value={o.price}
                        onChange={(e) => handleEdit(month, o.id, "price", Number(e.target.value))}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        value={o.advance !== undefined ? o.advance : ""}
                        onChange={(e) => handleEdit(month, o.id, "advance", Number(e.target.value))}
                      />
                    </td>
                    <td>
                      {o.isPaid ? (
                        <span
                          className="paid-badge"
                          onClick={(e) => { e.stopPropagation(); handleEdit(month, o.id, "isPaid", false); }}
                          title="Click to mark as unpaid"
                        >
                          <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{width: '14px', height: '14px'}}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                          Paid
                        </span>
                      ) : (
                        <div className="unpaid-container">
                          <input
                            type="number"
                            value={o.balance !== undefined ? o.balance : ((o.quantity * o.price) - (Number(o.advance) || 0))}
                            disabled
                          />
                          <button
                            type="button"
                            className="mark-paid-btn"
                            title="Mark as Paid"
                            onClick={(e) => { e.stopPropagation(); handleEdit(month, o.id, "isPaid", true); }}
                          >
                            <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{width: '16px', height: '16px'}}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </td>
                    <td>
                      <div className="actions-cell">
                        <button
                          className="action-icon"
                          title="Download PDF Bill"
                          onClick={() => downloadSingleInvoice(o)}
                        >
                          <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{width: '18px', height: '18px', color: '#ef4444'}}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                          </svg>
                        </button>
                        <button
                          className="action-icon"
                          title="Send WhatsApp Bill"
                          onClick={() => sendWhatsAppBill(o)}
                        >
                          <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{width: '18px', height: '18px', color: '#10b981'}}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
                          </svg>
                        </button>
                        <button
                          className="action-icon delete"
                          title="Delete Order"
                          onClick={() => handleDelete(o.id)}
                        >
                          <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{width: '18px', height: '18px'}}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="month-total">
              Total for {month}: Amount <span>₹{monthTotalAmount.toLocaleString("en-IN")}</span> | Advance <span>₹{monthTotalAdvance.toLocaleString("en-IN")}</span> | Balance <span>₹{monthTotalBalance.toLocaleString("en-IN")}</span>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="order-table-container">

      <h2>
        <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{width: '36px', height: '36px', color: '#00f2fe'}}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
        </svg>
        Shine Photo Frames Gallery
      </h2>

      {/* Summary */}
      <div className="summary-cards">
        <div className="summary-card">
          <p>Total Orders</p>
          <h3>{allOrders.length}</h3>
        </div>
        <div className="summary-card">
          <p>Advance Paid</p>
          <h3>₹{overallAdvance.toLocaleString("en-IN")}</h3>
        </div>
        <div className="summary-card" style={{borderColor: 'rgba(16, 185, 129, 0.4)'}}>
          <p>Pending Balance</p>
          <h3 style={{color: 'var(--success)'}}>₹{overallBalance.toLocaleString("en-IN")}</h3>
        </div>
        <div className="summary-card" style={{background: 'linear-gradient(135deg, rgba(79, 172, 254, 0.2) 0%, rgba(0, 242, 254, 0.1) 100%)'}}>
          <p>Total Amount</p>
          <h3 style={{color: 'var(--accent-cyan)'}}>₹{overallTotal.toLocaleString("en-IN")}</h3>
        </div>
      </div>

      {/* Inputs */}
      <div className="input-row">
        <div className="input-group">
          <label>Customer Name</label>
          <input
            type="text"
            name="customerName"
            placeholder="Enter name"
            value={newOrder.customerName}
            onChange={handleChange}
          />
        </div>

        <div className="input-group">
          <label>Phone Number</label>
          <input
            type="text"
            name="phone"
            placeholder="Enter phone"
            value={newOrder.phone}
            onChange={handleChange}
          />
        </div>

        <div className="input-group">
          <label>Frame Size</label>
          <select
            name="frameSize"
            value={newOrder.frameSize}
            onChange={handleChange}
          >
            <option value="">Select Size</option>
            {FRAME_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>

        {/* SHOW CUSTOM FIELD IF “OTHER” */}
        {newOrder.frameSize === "Other" && (
          <div className="input-group">
            <label>Custom Size</label>
            <input
              type="text"
              name="customFrameSize"
              placeholder="E.g. 15x20"
              value={newOrder.customFrameSize}
              onChange={handleChange}
            />
          </div>
        )}

        <div className="input-group">
          <label>Quantity</label>
          <input
            type="number"
            name="quantity"
            placeholder="Qty"
            value={newOrder.quantity}
            min="1"
            onChange={handleChange}
          />
        </div>

        <div className="input-group">
          <label>Price</label>
          <input
            type="number"
            name="price"
            placeholder="Price"
            value={newOrder.price}
            onChange={handleChange}
          />
        </div>

        <div className="input-group">
          <label>Advance</label>
          <input
            type="number"
            name="advance"
            placeholder="Advance"
            value={newOrder.advance}
            onChange={handleChange}
          />
        </div>

        <div className="input-group">
          <label>Balance</label>
          <input
            type="number"
            placeholder="Calculated"
            value={newOrder.price ? (((Number(newOrder.quantity) || 1) * Number(newOrder.price)) - (Number(newOrder.advance) || 0)) : ""}
            disabled
          />
        </div>

        <div className="input-group">
          <label>Date</label>
          <input type="date" value={newOrder.date} disabled />
        </div>

        <button className="btn-primary" onClick={handleAdd}>
          <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{width: '20px', height: '20px'}}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add
        </button>
      </div>

      <hr style={{ borderColor: 'rgba(255,255,255,0.1)', margin: '2rem 0' }} />

      {/* DAILY SECTION */}
      <div className="month-section">
        <div className="month-header" onClick={() => setExpandedDaily(!expandedDaily)}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{width: '24px', height: '24px', color: '#10b981'}}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 2.994v2.25m10.5-2.25v2.25m-14.25 8.25h16.5M2.994 6.75C2.994 5.23 4.225 4 5.744 4h12.512c1.519 0 2.75 1.231 2.75 2.75v14.506c0 1.52-1.231 2.75-2.75 2.75H5.744c-1.52 0-2.75-1.231-2.75-2.75V6.75z" />
            </svg>
            Daily Report
            <input 
              type="date" 
              value={dailyDate} 
              onChange={(e) => setDailyDate(e.target.value)} 
              onClick={(e) => e.stopPropagation()} 
              style={{ marginLeft: '10px', background: 'transparent', border: '1px solid rgba(255, 255, 255, 0.2)', color: '#fff', borderRadius: '4px', padding: '2px 6px', fontSize: '0.9rem' }}
            />
          </h3>

          <div className="download-buttons">
            <div className="search-box" onClick={(e) => e.stopPropagation()}>
              <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{width: '18px', height: '18px'}}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <input
                type="text"
                placeholder="Search orders..."
                value={searchDailyTerm}
                onChange={(e) => setSearchDailyTerm(e.target.value)}
              />
            </div>

            <button className="btn-secondary" onClick={(e) => { e.stopPropagation(); handleDownloadExcel(dailyDate || "Daily", filteredDaily); }}>
              <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{width: '18px', height: '18px', color: '#10b981'}}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m.75 12l3 3m0 0l3-3m-3 3v-6m-1.5-9H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
              Excel
            </button>

            <button className="btn-secondary" onClick={(e) => { e.stopPropagation(); handleDownloadPDF(dailyDate || "Daily", filteredDaily); }}>
              <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{width: '18px', height: '18px', color: '#ef4444'}}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
              PDF
            </button>
          </div>
        </div>

        {expandedDaily && (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Customer</th>
                  <th style={{ minWidth: '110px' }}>Phone</th>
                  <th>Frame Size</th>
                  <th style={{ minWidth: '80px', textAlign: 'center' }}>Qty</th>
                  <th>Price</th>
                  <th>Advance</th>
                  <th>Balance</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredDaily.length === 0 ? (
                  <tr>
                    <td colSpan="9" style={{ textAlign: "center", fontStyle: "italic", opacity: 0.6 }}>No orders found for this date.</td>
                  </tr>
                ) : filteredDaily.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <input
                        type="date"
                        value={o.date}
                        onChange={(e) => handleEdit(o.month, o.id, "date", e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={o.customerName}
                        onChange={(e) => handleEdit(o.month, o.id, "customerName", e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        style={{ minWidth: '110px' }}
                        value={o.phone || ""}
                        onChange={(e) => handleEdit(o.month, o.id, "phone", e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={o.frameSize}
                        onChange={(e) => handleEdit(o.month, o.id, "frameSize", e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        style={{ textAlign: 'center', minWidth: '60px' }}
                        value={o.quantity}
                        onChange={(e) => handleEdit(o.month, o.id, "quantity", Number(e.target.value))}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        value={o.price}
                        onChange={(e) => handleEdit(o.month, o.id, "price", Number(e.target.value))}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        value={o.advance !== undefined ? o.advance : ""}
                        onChange={(e) => handleEdit(o.month, o.id, "advance", Number(e.target.value))}
                      />
                    </td>
                    <td>
                      {o.isPaid ? (
                        <span
                          className="paid-badge"
                          onClick={(e) => { e.stopPropagation(); handleEdit(o.month, o.id, "isPaid", false); }}
                          title="Click to mark as unpaid"
                        >
                          <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{width: '14px', height: '14px'}}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                          Paid
                        </span>
                      ) : (
                        <div className="unpaid-container">
                          <input
                            type="number"
                            value={o.balance !== undefined ? o.balance : ((o.quantity * o.price) - (Number(o.advance) || 0))}
                            disabled
                          />
                          <button
                            type="button"
                            className="mark-paid-btn"
                            title="Mark as Paid"
                            onClick={(e) => { e.stopPropagation(); handleEdit(o.month, o.id, "isPaid", true); }}
                          >
                            <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{width: '16px', height: '16px'}}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </td>
                    <td>
                      <div className="actions-cell">
                        <button
                          className="action-icon"
                          title="Download PDF Bill"
                          onClick={() => downloadSingleInvoice(o)}
                        >
                          <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{width: '18px', height: '18px', color: '#ef4444'}}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                          </svg>
                        </button>
                        <button
                          className="action-icon"
                          title="Send WhatsApp Bill"
                          onClick={() => sendWhatsAppBill(o)}
                        >
                          <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{width: '18px', height: '18px', color: '#10b981'}}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
                          </svg>
                        </button>
                        <button
                          className="action-icon delete"
                          title="Delete Order"
                          onClick={() => handleDelete(o.id)}
                        >
                          <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{width: '18px', height: '18px'}}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="month-total" style={{ borderTop: '1px solid rgba(255,255,255,0.1)', marginTop: '0', paddingTop: '15px' }}>
              Total for {dailyDate || "Day"}: Amount <span>₹{dailyTotalAmount.toLocaleString("en-IN")}</span> | Advance <span>₹{dailyTotalAdvance.toLocaleString("en-IN")}</span> | Balance <span>₹{dailyTotalBalance.toLocaleString("en-IN")}</span>
            </div>
          </div>
        )}
      </div>

      {/* YEAR AND MONTH SECTIONS */}
      {sortedYears.map((year) => {
        const isCurrentYear = year === currentYear;
        const yearMonths = groupedByYear[year];

        if (isCurrentYear) {
          // Render current year's months directly
          return Object.entries(yearMonths).map(([month, monthOrders]) => 
            renderMonthSection(month, monthOrders)
          );
        } else {
          // Render past years as folders
          const openYear = expandedYear === year;
          const totalOrdersYear = Object.values(yearMonths).flat().length;

          return (
            <div key={year} className="year-section" style={{ marginBottom: '30px' }}>
              <div 
                className="month-header" 
                style={{ background: 'linear-gradient(90deg, rgba(236, 72, 153, 0.1) 0%, rgba(236, 72, 153, 0.02) 100%)', borderColor: 'rgba(236, 72, 153, 0.3)' }}
                onClick={() => toggleYear(year)}
              >
                <h3>
                  <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{width: '24px', height: '24px', color: '#ec4899'}}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0A2.25 2.25 0 001.5 12v6a2.25 2.25 0 002.25 2.25h16.5A2.25 2.25 0 0022.5 18v-6a2.25 2.25 0 00-1.5-2.224m-16.5 0V6a2.25 2.25 0 012.25-2.25h12A2.25 2.25 0 0119.5 6v3.776M12 15h.008v.008H12v-.008z" />
                  </svg>
                  {year} Archive Folder
                  <span style={{ fontSize: '1rem', color: 'var(--text-muted)', fontWeight: 'normal', marginLeft: '10px' }}>
                    ({totalOrdersYear} orders)
                  </span>
                </h3>

                <div className="download-buttons">
                  <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{width: '20px', height: '20px', color: 'var(--text-muted)'}}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" style={{ transform: openYear ? 'rotate(180deg)' : 'none', transformOrigin: 'center', transition: 'transform 0.3s' }} />
                  </svg>
                </div>
              </div>

              {openYear && (
                <div className="year-contents" style={{ paddingLeft: '15px', borderLeft: '2px solid rgba(236, 72, 153, 0.2)', marginLeft: '10px', marginTop: '15px' }}>
                  {Object.entries(yearMonths).map(([month, monthOrders]) => 
                    renderMonthSection(month, monthOrders)
                  )}
                </div>
              )}
            </div>
          );
        }
      })}
    </div>
  );
};

export default OrderTable;
